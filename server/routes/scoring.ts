// Mok Sports scoring routes - handles real scoring calculations with Tank01 API
import express from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { nflGames, nflTeams, weeklyLocks, userWeeklyScores, draftPicks, drafts, leagues, users } from "@shared/schema";
import {
  calculateWeeklyScores,
  MOK_SCORING_RULES
} from "../utils/mokScoring.js";

const router = express.Router();

// Helper function to calculate Mok points for a single team in a game
function calculateGameMokPoints(teamScore: number, opponentScore: number, isHome: boolean, isLocked: boolean, isLockAndLoad: boolean): number {
  if (teamScore === null || opponentScore === null) return 0;
  
  let points = 0;
  
  // Base points for win/tie
  if (teamScore > opponentScore) {
    points += 1; // Win = +1 point
    
    // Blowout bonus: +1 for winning by 20+ points
    if (teamScore - opponentScore >= 20) {
      points += 1;
    }
  } else if (teamScore === opponentScore) {
    points += 0.5; // Tie = +0.5 points
  }
  // Loss = 0 base points
  
  // Shutout bonus: +1 if opponent scored 0
  if (opponentScore === 0) {
    points += 1;
  }
  
  // Lock bonus: +1 additional point if this team was locked AND won
  if (isLocked && !isLockAndLoad && teamScore > opponentScore) {
    points += 1;
  }
  
  // Lock & Load: +2 for win, -1 for loss
  if (isLockAndLoad) {
    if (teamScore > opponentScore) {
      points += 2; // +2 for Lock & Load win
    } else if (teamScore < opponentScore) {
      points -= 1; // -1 for Lock & Load loss
    }
  }
  
  return points;
}

// Current week endpoint
router.get("/current-week", async (req, res) => {
  try {
    // Get current week from admin state
    const adminModule = await import("./admin.js");
    // In a real implementation, this would come from the admin state
    // Return Week 1 of 2024 season for testing with authentic results
    res.json({
      currentWeek: 1,
      season: 2024,
      status: "completed", // Week 1 has been completed
      message: "App is showing 2024 NFL season Week 1 results"
    });
  } catch (error) {
    console.error('[Scoring] Error getting current week:', error);
    res.status(500).json({ error: 'Failed to get current week' });
  }
});

// Get week scores with team ownership and lock data
router.get("/week/:week", async (req, res) => {
  try {
    const week = parseInt(req.params.week);
    // Use current year for production, or allow override for testing
    const season = parseInt(req.query.season as string) || new Date().getFullYear();
    const leagueId = req.query.leagueId || '243d719b-92ce-4752-8689-5da93ee69213'; // Default to EEW2YU league
    
    if (week < 1 || week > 18) {
      return res.status(400).json({ error: 'Invalid week number. Must be between 1-18.' });
    }
    
    console.log(`[Scoring] Getting scores for Week ${week} of ${season} with ownership data...`);
    
    // Get games with team ownership and lock information
    const gamesResult = await db.execute(sql`
      SELECT DISTINCT
        g.id as game_id,
        ht.code as home_team,
        at.code as away_team,
        g.home_score,
        g.away_score, 
        g.is_completed,
        g.game_date,
        -- Home team ownership
        home_user.name as home_owner_name,
        home_user.id as home_owner_id,
        -- Away team ownership  
        away_user.name as away_owner_name,
        away_user.id as away_owner_id,
        -- Lock information for this week (checking both regular lock and lock & load)
        CASE WHEN home_lock.locked_team_id IS NOT NULL OR home_lock.lock_and_load_team_id IS NOT NULL THEN true ELSE false END as home_locked,
        CASE WHEN home_lock.lock_and_load_team_id IS NOT NULL THEN true ELSE false END as home_lock_and_load,
        CASE WHEN away_lock.locked_team_id IS NOT NULL OR away_lock.lock_and_load_team_id IS NOT NULL THEN true ELSE false END as away_locked,
        CASE WHEN away_lock.lock_and_load_team_id IS NOT NULL THEN true ELSE false END as away_lock_and_load
      FROM nfl_games g
      JOIN nfl_teams ht ON g.home_team_id = ht.id
      JOIN nfl_teams at ON g.away_team_id = at.id
      -- Get draft data to find team owners
      LEFT JOIN (
        SELECT DISTINCT dp.nfl_team_id, u.name, u.id
        FROM draft_picks dp
        JOIN users u ON dp.user_id = u.id
        JOIN drafts d ON dp.draft_id = d.id
        WHERE d.league_id = ${leagueId}
      ) home_user ON home_user.nfl_team_id = ht.id
      LEFT JOIN (
        SELECT DISTINCT dp.nfl_team_id, u.name, u.id  
        FROM draft_picks dp
        JOIN users u ON dp.user_id = u.id
        JOIN drafts d ON dp.draft_id = d.id
        WHERE d.league_id = ${leagueId}
      ) away_user ON away_user.nfl_team_id = at.id
      -- Get lock information for this specific week
      LEFT JOIN weekly_locks home_lock ON (home_lock.locked_team_id = ht.id OR home_lock.lock_and_load_team_id = ht.id)
        AND home_lock.week = ${week} 
        AND home_lock.season = ${season}
      LEFT JOIN weekly_locks away_lock ON (away_lock.locked_team_id = at.id OR away_lock.lock_and_load_team_id = at.id)
        AND away_lock.week = ${week} 
        AND away_lock.season = ${season}
      WHERE g.week = ${week} AND g.season = ${season}
      ORDER BY g.game_date
    `);
    
    console.log(`[Scoring] Found ${gamesResult.rows.length} games for Week ${week} (${gamesResult.rows.filter(r => r.is_completed).length} completed)`);
    
    const games = gamesResult.rows.map((row: any) => {
      const isCompleted = Boolean(row.is_completed);
      // For production: only show scores for completed games
      // For 2024 testing: show all scores for validation
      const shouldShowScores = isCompleted || season === 2024; // Show all 2024 scores for testing
      
      return {
        id: row.game_id,
        homeTeam: row.home_team,
        awayTeam: row.away_team,
        homeScore: shouldShowScores ? row.home_score : null, // Only show scores for completed games (or 2024 testing)
        awayScore: shouldShowScores ? row.away_score : null, // Only show scores for completed games (or 2024 testing)
        // Show completion status directly from database
        isCompleted,
        gameDate: row.game_date,
        // Team ownership information
        homeOwner: row.home_owner_id,
        awayOwner: row.away_owner_id,
        homeOwnerName: row.home_owner_name,
        awayOwnerName: row.away_owner_name,
        // Lock status
        homeLocked: row.home_locked,
        awayLocked: row.away_locked,
        homeLockAndLoad: row.home_lock_and_load,
        awayLockAndLoad: row.away_lock_and_load,
        // Calculate actual Mok points for each team - only for completed games
        homeMokPoints: shouldShowScores && row.home_owner_name ? calculateGameMokPoints(row.home_score, row.away_score, true, row.home_locked, row.home_lock_and_load) : 0,
        awayMokPoints: shouldShowScores && row.away_owner_name ? calculateGameMokPoints(row.away_score, row.home_score, false, row.away_locked, row.away_lock_and_load) : 0
      };
    });
    
    res.json({
      week,
      season,
      leagueId,
      games: games.length,
      completedGames: games.filter(g => g.isCompleted).length,
      // Add production readiness indicator
      production: season >= 2025,
      message: season === 2024 ? 'Testing mode: All scores visible' : 'Production mode: Only completed game scores visible',
      results: games
    });
    
  } catch (error) {
    console.error('[Scoring] Error getting week scores:', error);
    res.status(500).json({ error: 'Failed to get week scores' });
  }
});

// Get league standings
router.get("/standings/:leagueId", async (req, res) => {
  try {
    const leagueId = req.params.leagueId;
    
    // Get league info and draft picks for user teams
    const league = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    if (!league.length) {
      return res.status(404).json({ error: 'League not found' });
    }
    
    // Get draft data to show user teams
    const leagueDrafts = await db.select().from(drafts).where(eq(drafts.leagueId, leagueId));
    if (!leagueDrafts.length) {
      return res.json({ 
        league: league[0].name,
        message: 'No draft completed yet',
        standings: [] 
      });
    }
    
    // Get draft picks using raw SQL for now
    const picksResult = await db.execute(sql`
      SELECT 
        dp.user_id,
        nt.code as team_code,
        nt.name as team_name,
        u.name as user_name
      FROM draft_picks dp
      JOIN nfl_teams nt ON dp.nfl_team_id = nt.id
      JOIN users u ON dp.user_id = u.id
      WHERE dp.draft_id = ${leagueDrafts[0].id}
    `);
    
    const picks = picksResult.rows.map((row: any) => ({
      userId: row.user_id,
      teamCode: row.team_code,
      teamName: row.team_name,
      userName: row.user_name
    }));
    
    // Group picks by user
    const userTeams = picks.reduce((acc, pick) => {
      if (!acc[pick.userId]) {
        acc[pick.userId] = {
          userId: pick.userId,
          userName: pick.userName,
          teams: [],
          totalPoints: 0 // Will be calculated when scoring is implemented
        };
      }
      acc[pick.userId].teams.push({
        code: pick.teamCode,
        name: pick.teamName
      });
      return acc;
    }, {} as any);
    
    res.json({
      league: league[0].name,
      currentWeek: 0,
      season: 2024,
      standings: Object.values(userTeams)
    });
    
  } catch (error) {
    console.error('[Scoring] Error getting standings:', error);
    res.status(500).json({ error: 'Failed to get standings' });
  }
});

export { router as scoringRouter };

// Authentication helper function (copied from routes.ts)
async function getAuthenticatedUser(req: any) {
  // Try Authorization header first (PWA-friendly)
  const authHeader = req.headers.authorization;
  let token = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
    console.log("[Scoring Auth] Using Bearer token from header");
  } else {
    // Fallback to cookie
    token = req.cookies?.auth_token;
    if (token) {
      console.log("[Scoring Auth] Using token from cookie");
    }
  }
  
  if (!token) {
    console.log("[Scoring Auth] No token found in header or cookies");
    
    // For development: Return Sky Evans if no token (PWA cookie issue workaround)
    if (process.env.NODE_ENV === 'development') {
      console.log("[Scoring Auth] Development mode - returning Sky Evans for scoring access");
      return {
        id: "9932fcd8-7fbb-49c3-8fbb-f254cff1bb9a",
        name: "Sky Evans", 
        email: "skyevans04@gmail.com"
      };
    }
    return null;
  }

  try {
    // Use dynamic import for ES modules
    const authModule = await import("../auth.js");
    const user = authModule.verifyJWT(token);
    
    if (!user || typeof user === 'string') {
      console.log("[Scoring Auth] Invalid token or wrong format");
      
      // For development: Fall back to Sky Evans on token verification failure
      if (process.env.NODE_ENV === 'development') {
        console.log("[Scoring Auth] Development mode - falling back to Sky Evans for invalid token");
        return {
          id: "9932fcd8-7fbb-49c3-8fbb-f254cff1bb9a",
          name: "Sky Evans", 
          email: "skyevans04@gmail.com"
        };
      }
      return null;
    }

    console.log("[Scoring Auth] User authenticated:", (user as any).name);
    return user as any;
  } catch (error) {
    console.error("[Scoring Auth] Token verification error:", error);
    
    // For development: Fall back to Sky Evans on token verification error
    if (process.env.NODE_ENV === 'development') {
      console.log("[Scoring Auth] Development mode - falling back to Sky Evans for token error");
      return {
        id: "9932fcd8-7fbb-49c3-8fbb-f254cff1bb9a",
        name: "Sky Evans", 
        email: "skyevans04@gmail.com"
      };
    }
    return null;
  }
}

export function setupScoringRoutes(app: express.Express) {
  
  // Get current scoring rules
  app.get("/api/scoring/rules", async (req, res) => {
    try {
      res.json(MOK_SCORING_RULES);
    } catch (error) {
      console.error('Error getting scoring rules:', error);
      res.status(500).json({ message: "Failed to get scoring rules" });
    }
  });

  // Get weekly scores for a league
  app.get("/api/leagues/:leagueId/scores/:season/:week", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { leagueId, season, week } = req.params;
      
      // Check if user is member of this league
      const isMember = await storage.isUserInLeague(user.id, leagueId);
      if (!isMember) {
        return res.status(403).json({ message: "Not authorized to view this league" });
      }

      const seasonNum = parseInt(season);
      const weekNum = parseInt(week);

      if (isNaN(seasonNum) || isNaN(weekNum)) {
        return res.status(400).json({ message: "Invalid season or week" });
      }

      const weeklyScores = await calculateWeeklyScores(leagueId, weekNum, seasonNum);
      res.json({ scores: weeklyScores, week: weekNum, season: seasonNum });
    } catch (error) {
      console.error('Error getting weekly scores:', error);
      res.status(500).json({ message: "Failed to get weekly scores" });
    }
  });

  // Get season standings for a league
  app.get("/api/leagues/:leagueId/standings/:season", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { leagueId, season } = req.params;
      const currentWeek = parseInt(req.query.currentWeek as string) || 1;
      
      // Check if user is member of this league
      const isMember = await storage.isUserInLeague(user.id, leagueId);
      if (!isMember) {
        return res.status(403).json({ message: "Not authorized to view this league" });
      }

      const seasonNum = parseInt(season);
      if (isNaN(seasonNum)) {
        return res.status(400).json({ message: "Invalid season" });
      }

      // TODO: Implement calculateSeasonStandings function
      const standings: any[] = [];
      res.json(standings);
    } catch (error) {
      console.error('Error getting season standings:', error);
      res.status(500).json({ message: "Failed to get season standings" });
    }
  });

  // Set weekly lock selections
  app.post("/api/leagues/:leagueId/locks", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { leagueId } = req.params;
      
      // Check if user is member of this league
      const isMember = await storage.isUserInLeague(user.id, leagueId);
      if (!isMember) {
        return res.status(403).json({ message: "Not authorized to modify this league" });
      }

      const lockSchema = z.object({
        season: z.number(),
        week: z.number(),
        lockedTeamId: z.string().optional(),
        lockAndLoadTeamId: z.string().optional(),
      });

      const { season, week, lockedTeamId, lockAndLoadTeamId } = lockSchema.parse(req.body);

      // TODO: Validate lock usage if provided
      if (lockedTeamId) {
        // const validation = await validateLockUsage(user.id, leagueId, lockedTeamId, 'lock');
        // if (!validation.valid) {
        //   return res.status(400).json({ message: validation.reason });
        // }
      }

      if (lockAndLoadTeamId) {
        // const validation = await validateLockUsage(user.id, leagueId, lockAndLoadTeamId, 'lockAndLoad');
        // if (!validation.valid) {
        //   return res.status(400).json({ message: validation.reason });
        // }
      }

      // Set weekly locks in database
      await storage.setWeeklyLocks(user.id, leagueId, season, week, { lockedTeamId, lockAndLoadTeamId });

      // Broadcast lock update to all connected clients for instant UI refresh
      const draftManager = (global as any).draftManager;
      if (draftManager && draftManager.broadcast) {
        draftManager.broadcast({
          type: 'lock_updated',
          data: {
            userId: user.id,
            leagueId,
            season,
            week,
            lockedTeamId,
            lockAndLoadTeamId,
            userName: user.name
          }
        });
        console.log(`[Locks] ✅ Broadcast sent for lock update by ${user.name}`);
      }

      res.json({ 
        success: true, 
        message: "Lock selections saved",
        data: { season, week, lockedTeamId, lockAndLoadTeamId }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      console.error('Error setting weekly locks:', error);
      res.status(500).json({ message: "Failed to set weekly locks" });
    }
  });

  // Get user's lock history
  app.get("/api/leagues/:leagueId/locks/history", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { leagueId } = req.params;
      const season = parseInt(req.query.season as string) || new Date().getFullYear();
      
      // Check if user is member of this league
      const isMember = await storage.isUserInLeague(user.id, leagueId);
      if (!isMember) {
        return res.status(403).json({ message: "Not authorized to view this league" });
      }

      // TODO: Implement storage method for lock history
      // const lockHistory = await storage.getUserLockHistory(user.id, leagueId, season);
      const lockHistory: any[] = [];

      res.json({ 
        lockHistory, 
        season,
        usage: {
          totalLocksAvailable: MOK_SCORING_RULES.maxLocksPerTeamPerSeason * 5, // 5 teams * 4 locks each
          totalLockAndLoadAvailable: MOK_SCORING_RULES.maxLockAndLoadPerTeamPerSeason * 5 // 5 teams * 1 L&L each
        }
      });
    } catch (error) {
      console.error('Error getting lock history:', error);
      res.status(500).json({ message: "Failed to get lock history" });
    }
  });

  // Validate lock usage for a specific team
  app.post("/api/leagues/:leagueId/locks/validate", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { leagueId } = req.params;
      
      // Check if user is member of this league
      const isMember = await storage.isUserInLeague(user.id, leagueId);
      if (!isMember) {
        return res.status(403).json({ message: "Not authorized to modify this league" });
      }

      const validationSchema = z.object({
        nflTeamId: z.string(),
        lockType: z.enum(['lock', 'lockAndLoad']),
      });

      const { nflTeamId, lockType } = validationSchema.parse(req.body);

      // TODO: Implement validateLockUsage function
      const validation = { valid: true, reason: null };
      
      res.json(validation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      console.error('Error validating lock usage:', error);
      res.status(500).json({ message: "Failed to validate lock usage" });
    }
  });

  console.log("📊 Scoring routes registered successfully");
}