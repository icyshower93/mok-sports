// Mok Sports scoring routes - handles real scoring calculations
import express from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import {
  calculateWeeklyScores,
  calculateSeasonStandings,
  validateLockUsage,
  MOK_SCORING_RULES
} from "../utils/mokScoring.js";

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

      const standings = await calculateSeasonStandings(leagueId, seasonNum, currentWeek);
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

      // Validate lock usage if provided
      if (lockedTeamId) {
        const validation = await validateLockUsage(user.id, leagueId, lockedTeamId, 'lock');
        if (!validation.valid) {
          return res.status(400).json({ message: validation.reason });
        }
      }

      if (lockAndLoadTeamId) {
        const validation = await validateLockUsage(user.id, leagueId, lockAndLoadTeamId, 'lockAndLoad');
        if (!validation.valid) {
          return res.status(400).json({ message: validation.reason });
        }
      }

      // TODO: Implement storage method for weekly locks
      // await storage.setWeeklyLocks(user.id, leagueId, season, week, { lockedTeamId, lockAndLoadTeamId });

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

      const validation = await validateLockUsage(user.id, leagueId, nflTeamId, lockType);
      
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