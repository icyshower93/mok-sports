import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { generateJWT, authenticateJWT, isOAuthConfigured } from "./auth";
import { storage } from "./storage";
import { generateJoinCode } from "./utils";
import { insertLeagueSchema, draftPicks, drafts, draftTimers, userWeeklyScores, weeklyLocks, nflTeams, stables } from "@shared/schema";
import { z } from "zod";
import { registerPushNotificationRoutes } from "./routes/push-notifications";
import { registerPushDiagnosticsRoutes } from "./routes/push-diagnostics";
import { registerSubscriptionValidationRoutes } from "./routes/subscription-validation";
import { registerAdminRoutes } from "./routes/admin";
import { scoringRouter } from "./routes/scoring";
import { registerDatabaseViewerRoutes } from "./routes/database-viewer";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import crypto from "crypto";
import "./auth"; // Initialize passport strategies

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize passport
  app.use(passport.initialize());

  // Health check endpoint for deployment monitoring
  app.get("/api/health", async (req, res) => {
    try {
      // Check database connection
      const dbCheck = await db.select().from(sql`(SELECT 1 as test)`).limit(1);
      
      const healthStatus = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "unknown",
        database: dbCheck.length > 0 ? "connected" : "disconnected",
        environment: process.env.NODE_ENV || "unknown"
      };
      
      res.status(200).json(healthStatus);
    } catch (error) {
      res.status(503).json({
        status: "unhealthy", 
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Google OAuth routes - only if OAuth is configured
  if (isOAuthConfigured) {
    app.get("/api/auth/google", 
      passport.authenticate("google", { scope: ["profile", "email"] })
    );

    app.get("/api/auth/google/callback",
      passport.authenticate("google", { session: false }),
      async (req, res) => {
        try {
          const user = req.user as any;
          if (!user) {
            return res.redirect("/?error=auth_failed");
          }

          const token = generateJWT(user);
          
          // Set JWT as httpOnly cookie and redirect
          // Enhanced cookie settings for PWA compatibility
          const isProduction = process.env.NODE_ENV === "production";
          const cookieOptions = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" as const : "lax" as const,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: '/',
            domain: undefined // Let browser set domain automatically
          };
          
          
          res.cookie("auth_token", token, cookieOptions);

          // Note: Welcome notifications are now handled by the client-side post-login flow
          // This ensures proper timing and user interaction context for notifications

          // Redirect with token in URL for PWA compatibility (will be stored in localStorage)
          res.redirect(`/?auth=success&token=${encodeURIComponent(token)}`);
        } catch (error) {
          res.redirect("/?error=auth_failed");
        }
      }
    );
  } else {
    // Fallback routes when OAuth is not configured
    app.get("/api/auth/google", (req, res) => {
      res.status(503).json({ 
        error: "OAuth not configured", 
        message: "Google authentication is currently unavailable. Please contact the administrator." 
      });
    });

    app.get("/api/auth/google/callback", (req, res) => {
      res.redirect("/?error=oauth_not_configured");
    });
  }

  // Testing endpoints (development only)
  if (process.env.NODE_ENV === "development") {
    // Timer recovery endpoint for debugging
    app.post("/api/testing/timer-recovery", async (req, res) => {
      try {
        const draftWebSocket = await import("./websocket/draftWebSocket");
        if (draftWebSocket && draftWebSocket.recoverActiveTimers) {
          await draftWebSocket.recoverActiveTimers();
          res.json({ success: true, message: "Timer recovery completed" });
        } else {
          res.status(500).json({ error: "Draft manager not available" });
        }
      } catch (error: any) {
        console.error("Timer recovery error:", error);
        res.status(500).json({ error: error?.message || "Unknown error" });
      }
    });

    app.post("/api/auth/testing/login", async (req, res) => {
      try {
        const { userId } = req.body;
        
        let user;
        if (userId) {
          user = await storage.getUser(userId);
        } else {
          // REMOVED: No automatic Sky Evans defaults (causes PWA conflicts)
          return res.status(400).json({ message: "User ID required for team stable lookup" });
        }
        
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        const token = generateJWT(user);
        
        const cookieOptions = {
          httpOnly: true,
          secure: false,
          sameSite: "lax" as const,
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: '/'
        };
        
        res.cookie("auth_token", token, cookieOptions);
        res.json({ 
          success: true, 
          user: { id: user.id, name: user.name, email: user.email },
          token: token // Include token in response for PWA localStorage storage
        });
      } catch (error) {
        console.error("Testing login error:", error);
        res.status(500).json({ message: "Login failed" });
      }
    });
  }

  // Check OAuth configuration status
  app.get("/api/auth/config", (req, res) => {
    res.json({ 
      oauthConfigured: isOAuthConfigured,
      provider: "google" 
    });
  });

  // Authentication middleware that supports both header and cookie tokens
  async function getAuthenticatedUser(req: any) {
    // Try Authorization header first (PWA-friendly)
    const authHeader = req.headers.authorization;
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      console.log("[Auth] Using Bearer token from header");
    } else {
      // Fallback to cookie
      token = req.cookies?.auth_token;
      if (token) {
        console.log("[Auth] Using token from cookie");
      }
    }
    
    if (!token) {
      console.log("[Auth] No token found in header or cookies");
      console.log("[Auth] Available cookies:", Object.keys(req.cookies || {}));
      console.log("[Auth] Authorization header:", authHeader);
      
      // REMOVED: No more automatic fallback to Sky Evans (causes PWA conflicts)
      console.log("[Auth] No token found - authentication required");
      
      return null;
    }

    try {
      const { verifyJWT: verify } = await import("./auth.js");
      const user = verify(token);
      
      if (!user || typeof user === 'string') {
        console.log("[Auth] Invalid token or wrong format");
        
        // REMOVED: No more automatic fallback to Sky Evans (causes PWA conflicts)
        console.log("[Auth] Invalid token - authentication required");
        return null;
      }

      console.log("[Auth] User authenticated:", (user as any).name);
      return user as any;
    } catch (error) {
      console.error("[Auth] Token verification error:", error);
      
      // REMOVED: No more automatic fallback to Sky Evans (causes PWA conflicts)
      console.log("[Auth] Token verification error - authentication required");
      return null;
    }
  }

  // Get current user
  app.get("/api/auth/me", async (req, res) => {
    const user = await getAuthenticatedUser(req);
    
    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    res.json(user);
  });

  // Get user's leagues
  app.get("/api/user/leagues", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userLeagues = await storage.getUserLeagues(user.id);
      res.json(userLeagues);
    } catch (error) {
      console.error('Error getting user leagues:', error);
      res.status(500).json({ message: "Failed to get user leagues" });
    }
  });

  // Initialize stable from completed drafts (manual trigger for testing)
  app.post("/api/stable/initialize", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { draftId } = req.body;
      if (!draftId) {
        return res.status(400).json({ message: "Draft ID is required" });
      }

      // Verify user has access to this draft
      const draft = await storage.getDraft(draftId);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      // Check if user is in the league
      const isInLeague = await storage.isUserInLeague(user.id, draft.leagueId);
      if (!isInLeague) {
        return res.status(403).json({ message: "Access denied to this draft" });
      }

      await storage.initializeStableFromDraft(draftId);
      res.json({ message: "Stable initialized successfully", draftId });
    } catch (error) {
      console.error('Error initializing stable:', error);
      res.status(500).json({ message: "Failed to initialize stable", error: error.message });
    }
  });

  // Add routes for free agent trading
  app.post("/api/stable/add-free-agent", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { leagueId, nflTeamId } = req.body;
      if (!leagueId || !nflTeamId) {
        return res.status(400).json({ message: "League ID and NFL Team ID are required" });
      }

      // Check if user is in the league
      const isInLeague = await storage.isUserInLeague(user.id, leagueId);
      if (!isInLeague) {
        return res.status(403).json({ message: "Access denied to this league" });
      }

      await storage.addFreeAgentToStable(user.id, leagueId, nflTeamId);
      res.json({ message: "Free agent added to stable successfully" });
    } catch (error) {
      console.error('Error adding free agent:', error);
      res.status(500).json({ message: "Failed to add free agent", error: error.message });
    }
  });

  app.delete("/api/stable/remove-team", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { leagueId, nflTeamId } = req.body;
      if (!leagueId || !nflTeamId) {
        return res.status(400).json({ message: "League ID and NFL Team ID are required" });
      }

      // Check if user is in the league
      const isInLeague = await storage.isUserInLeague(user.id, leagueId);
      if (!isInLeague) {
        return res.status(403).json({ message: "Access denied to this league" });
      }

      await storage.removeStableTeam(user.id, leagueId, nflTeamId);
      res.json({ message: "Team removed from stable successfully" });
    } catch (error) {
      console.error('Error removing team from stable:', error);
      res.status(500).json({ message: "Failed to remove team from stable", error: error.message });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("auth_token");
    res.json({ message: "Logged out successfully" });
  });

  // League routes
  app.post("/api/leagues", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Validate request body - only validate what comes from frontend
      const createLeagueSchema = z.object({
        name: z.string().min(1, "League name is required").max(50, "League name too long"),
        maxTeams: z.number().min(2, "Must have at least 2 teams").max(20, "Maximum 20 teams allowed"),
      });

      const validatedData = createLeagueSchema.parse(req.body);
      
      // Check if league name already exists
      const existingLeague = await storage.getLeagueByName(validatedData.name);
      if (existingLeague) {
        return res.status(400).json({ message: "A league with this name already exists" });
      }
      
      // Generate unique join code
      let joinCode: string;
      let isUnique = false;
      let attempts = 0;
      
      do {
        joinCode = generateJoinCode();
        const existing = await storage.getLeagueByJoinCode(joinCode);
        isUnique = !existing;
        attempts++;
      } while (!isUnique && attempts < 10);

      if (!isUnique) {
        return res.status(500).json({ message: "Failed to generate unique join code" });
      }

      const league = await storage.createLeague({
        ...validatedData,
        creatorId: user.id,
        joinCode: joinCode!,
      });

      res.status(201).json(league);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create league" });
    }
  });

  app.get("/api/leagues/user", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const leagues = await storage.getUserLeagues(user.id);
      res.json(leagues);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch leagues" });
    }
  });

  // Get league details with all members and their teams
  app.get("/api/leagues/:leagueId/standings", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { leagueId } = req.params;
      
      // Check if user is member of this league
      const isMember = await storage.isUserInLeague(user.id, leagueId);
      if (!isMember) {
        return res.status(403).json({ message: "Not authorized to view this league" });
      }

      // Get league details
      const league = await storage.getLeague(leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      // Derive current NFL week for this season by looking at the max completed/ongoing game week
      const seasonNum = 2024; // or read from league/setting if you support multiple seasons

      const maxCompletedWeekResult = await db.execute(sql`
        SELECT COALESCE(MAX(week), 0) AS week
        FROM nfl_games
        WHERE season = ${seasonNum} AND is_completed = true
      `);
      const maxCompletedWeek = (maxCompletedWeekResult.rows[0] as any)?.week || 0;

      const maxAnyWeekResult = await db.execute(sql`
        SELECT COALESCE(MAX(week), 1) AS week
        FROM nfl_games
        WHERE season = ${seasonNum}
      `);
      const maxAnyWeek = (maxAnyWeekResult.rows[0] as any)?.week || 1;

      // If no games completed yet this week, still compute for the current scheduled week
      const weekNum = Math.max(maxCompletedWeek, maxAnyWeek);

      // Ensure weekly scores are up to date for the derived week
      const { calculateWeeklyScores } = await import("./utils/mokScoring.js");
      await calculateWeeklyScores(leagueId, weekNum, seasonNum);

      // Get all league members
      const members = await storage.getLeagueMembers(leagueId);
      
      // Get each member's stable teams and real scoring data
      const standings = [];
      
      for (const member of members) {
        // Get user details
        const memberUser = await storage.getUser(member.userId);
        if (!memberUser) continue;
        
        // Get their stable teams with auto-heal
        let stable = await storage.getUserStable(member.userId, leagueId);
        
        // Auto-heal: if stable is empty but league has completed draft, backfill from draft
        if (stable.length === 0) {
          try {
            const draft = await storage.getLeagueDraft(leagueId);
            if (draft?.status === "completed") {
              console.log(`[Standings Auto-heal] Backfilling stable for user ${member.userId} in league ${leagueId} from completed draft ${draft.id}`);
              await storage.initializeStableFromDraft(draft.id);
              // Re-read stable after backfill
              stable = await storage.getUserStable(member.userId, leagueId);
              console.log(`[Standings Auto-heal] Backfill complete, found ${stable.length} teams`);
            }
          } catch (healError) {
            console.warn(`[Standings Auto-heal] Failed to backfill stable for user ${member.userId} in league ${leagueId}:`, healError);
            // Continue with empty stable rather than crashing
          }
        }
        
        // Get real scoring data from database (scoped to this league)
        const userScores = await db.select()
          .from(userWeeklyScores)
          .where(and(
            eq(userWeeklyScores.userId, member.userId),
            eq(userWeeklyScores.leagueId, leagueId),
            eq(userWeeklyScores.season, 2024)
          ));
        
        // Get locks used count (scoped to this league)
        const userLocks = await db.select()
          .from(weeklyLocks)
          .where(and(
            eq(weeklyLocks.userId, member.userId),
            eq(weeklyLocks.leagueId, leagueId),
            eq(weeklyLocks.season, 2024)
          ));
        
        // Calculate real totals
        const totalPoints = userScores.reduce((sum, score) => sum + (score.totalPoints || 0), 0);
        const totalWins = userScores.reduce((sum, score) => sum + (score.teamWins || 0), 0);
        const totalLocks = userLocks.filter(lock => lock.correct).length; // Only correct locks
        const totalLockAndLoads = userLocks.filter(lock => lock.lockAndLoad).length;
        const skinsWon = userScores.reduce((sum, score) => sum + (score.skinsWon || 0), 0);
        const teams = stable.map(stableTeam => ({
          code: stableTeam.nflTeam.code,
          name: stableTeam.nflTeam.name
        }));
        
        standings.push({
          userId: member.userId,
          name: memberUser.name,
          avatar: memberUser.name.split(' ').map(n => n[0]).join('').toUpperCase(),
          points: totalPoints,
          wins: totalWins,
          locks: totalLocks,
          lockAndLoads: totalLockAndLoads,
          skinsWon: skinsWon,
          isCurrentUser: member.userId === user.id,
          teams: teams,
          joinedAt: member.joinedAt
        });
      }
      
      // Sort by points (descending) and add ranks
      standings.sort((a, b) => b.points - a.points);
      standings.forEach((standing, index) => {
        (standing as any).rank = index + 1;
      });

      // League info
      const leagueInfo = {
        id: league.id,
        name: league.name,
        joinCode: league.joinCode,
        season: "2025",
        week: 1, // This would come from admin state
        totalWeeks: 18,
        memberCount: standings.length,
        weeklyPot: 30, // Skins prize per week
        seasonPot: 80  // Total season prizes ($50 + $10 + $10 + $10)
      };

      res.json({
        league: leagueInfo,
        standings,
        seasonPrizes: [
          { name: "Most Points", prize: "$50", leader: standings[0]?.name || "TBD", points: standings[0]?.points?.toString() || "-" },
          { name: "Super Bowl Winner", prize: "$10", leader: "TBD", points: "-" },
          { name: "Most Correct Locks", prize: "$10", leader: standings.find(s => s.locks > 0)?.name || "TBD", points: standings.find(s => s.locks > 0)?.locks?.toString() || "0" }
        ]
      });
    } catch (error) {
      console.error('Error getting league standings:', error);
      res.status(500).json({ message: "Failed to get league standings" });
    }
  });

  // Get league statistics for dashboard
  app.get("/api/leagues/stats", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Get user's league participation stats
      const userLeagues = await storage.getUserLeagues(user.id);
      const completedDrafts = await storage.getUserCompletedDrafts(user.id);
      
      // Calculate basic stats
      const stats = {
        totalLeagues: userLeagues.length,
        draftsCompleted: completedDrafts.length,
        winRate: completedDrafts.length > 0 ? Math.floor(Math.random() * 40) + 50 : 0, // Placeholder calculation
        activeLeagues: userLeagues.filter((l: any) => l.isActive).length
      };

      res.json(stats);
    } catch (error) {
      console.error('Error getting league stats:', error);
      res.status(500).json({ message: "Failed to get stats" });
    }
  });

  app.post("/api/leagues/join", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { joinCode } = req.body;
      if (!joinCode) {
        return res.status(400).json({ message: "Join code is required" });
      }

      // Find league by join code
      const league = await storage.getLeagueByJoinCode(joinCode.toUpperCase());
      if (!league) {
        return res.status(404).json({ message: "That code doesn't exist" });
      }

      // Check if user is already in league
      const isAlreadyMember = await storage.isUserInLeague(user.id, league.id);
      if (isAlreadyMember) {
        return res.status(400).json({ message: "You're already in this league" });
      }

      // Check if league is full
      const memberCount = await storage.getLeagueMemberCount(league.id);
      if (memberCount >= league.maxTeams) {
        return res.status(400).json({ message: "League is full" });
      }

      // Add user to league
      await storage.joinLeague({
        leagueId: league.id,
        userId: user.id,
      });

      // Check if league just became full and send notifications using reusable pattern
      const newMemberCount = await storage.getLeagueMemberCount(league.id);
      console.log(`🔍 [JOIN LEAGUE] ${league.name} member count after join: ${newMemberCount}/${league.maxTeams}`);
      
      if (newMemberCount === league.maxTeams) {
        console.log(`🎯 [LEAGUE FULL] ${league.name} is now full! Sending notifications...`);
        
        try {
          // Use the reusable notification pattern
          const { sendLeagueNotification, NotificationTemplates } = await import("./utils/notification-patterns.js");
          
          const notification = NotificationTemplates.leagueFull(league.name, league.id);
          console.log(`📱 [NOTIFICATION] Creating notification:`, JSON.stringify(notification, null, 2));
          
          const result = await sendLeagueNotification(league.id, notification);
          
          if (result.success) {
            console.log(`✅ [SUCCESS] Successfully sent league full notifications to ${result.sentCount} devices`);
          } else {
            console.error(`❌ [FAILED] Failed to send league full notifications:`, result.errors);
          }
          
          console.log(`📊 [RESULT] Full notification result:`, JSON.stringify(result, null, 2));
        } catch (notificationError) {
          console.error(`💥 [ERROR] Exception in notification sending:`, notificationError);
          // Don't fail the join request if notifications fail
        }
      } else {
        console.log(`ℹ️ [NOT FULL] League ${league.name} not full yet (${newMemberCount}/${league.maxTeams}) - no notifications sent`);
      }

      // Return the league with updated member count
      const updatedLeague = await storage.getLeague(league.id);
      res.json({ message: "Successfully joined league", league: updatedLeague });
    } catch (error) {
      res.status(500).json({ message: "Failed to join league" });
    }
  });

  // Get specific league
  app.get("/api/leagues/:id", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { id } = req.params;
      const league = await storage.getLeague(id);
      
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      // Check if user is member of this league
      const isMember = await storage.isUserInLeague(user.id, id);
      console.log(`[League Access] User ${user.id} checking membership in league ${id}: ${isMember}`);
      if (!isMember) {
        return res.status(403).json({ message: "Not authorized to view this league" });
      }

      res.json(league);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch league" });
    }
  });

  // Get VAPID public key for push notifications
  app.get("/api/vapid-public-key", async (req, res) => {
    try {
      const vapidKeys = storage.getVapidKeys();
      res.json({ publicKey: vapidKeys.publicKey });
    } catch (error) {
      console.error('Error getting VAPID public key:', error);
      res.status(500).json({ message: "Failed to get VAPID public key" });
    }
  });

  // Leave league
  app.post("/api/leagues/:id/leave", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { id } = req.params;

      // Check if user is in the league
      const isMember = await storage.isUserInLeague(user.id, id);
      console.log(`[Leave League] User ${user.id} attempting to leave league ${id}, is member: ${isMember}`);
      
      if (!isMember) {
        return res.status(400).json({ message: "You are not a member of this league" });
      }

      await storage.leaveLeague(user.id, id);
      console.log(`[Leave League] User ${user.id} successfully left league ${id}`);
      res.json({ message: "Successfully left league" });
    } catch (error) {
      console.error('[Leave League] Error:', error);
      res.status(500).json({ message: "Failed to leave league" });
    }
  });

  // Debug endpoint - commented out for production (uncomment to re-enable testing)
  /*
  app.post("/api/leagues/test-full-notification", async (req, res) => {
    try {
      const { leagueId } = req.body;
      if (!leagueId) {
        return res.status(400).json({ message: "League ID is required" });
      }

      console.log(`🧪 [TEST] Manually testing league full notification for league ${leagueId}`);
      
      // Get league info
      const league = await storage.getLeague(leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      console.log(`🧪 [TEST] League: ${league.name}`);
      
      // Check current member count
      const memberCount = await storage.getLeagueMemberCount(league.id);
      console.log(`🧪 [TEST] Member count: ${memberCount}/${league.maxTeams}`);
      
      // Force trigger notification regardless of member count for testing
      const { sendLeagueNotification, NotificationTemplates } = await import("./utils/notification-patterns.js");
      
      const notification = NotificationTemplates.leagueFull(league.name, league.id);
      console.log(`🧪 [TEST] Creating test notification:`, JSON.stringify(notification, null, 2));
      
      const result = await sendLeagueNotification(league.id, notification);
      
      console.log(`🧪 [TEST] Notification result:`, JSON.stringify(result, null, 2));
      
      res.json({
        success: true,
        league: league.name,
        memberCount: `${memberCount}/${league.maxTeams}`,
        notificationResult: result
      });
      
    } catch (error) {
      console.error(`🧪 [TEST ERROR]`, error);
      res.status(500).json({ message: "Failed to test notification", error: error instanceof Error ? error.message : String(error) });
    }
  });
  */

  // Remove member from league (creator only)
  app.post("/api/leagues/:id/remove-member", async (req, res) => {
    try {
      const token = req.cookies?.auth_token;
      if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { verifyJWT } = require("./auth");
      const user = verifyJWT(token);
      if (!user) {
        return res.status(401).json({ message: "Invalid token" });
      }

      const { id } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Get league to check if user is the creator
      const league = await storage.getLeague(id);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      // Only league creator can remove members
      if (league.creatorId !== user.id) {
        return res.status(403).json({ message: "Only league creator can remove members" });
      }

      // Check if target user is in the league
      const isMember = await storage.isUserInLeague(userId, id);
      if (!isMember) {
        return res.status(400).json({ message: "User is not a member of this league" });
      }

      // Creator cannot remove themselves this way (they should use leave endpoint)
      if (userId === user.id) {
        return res.status(400).json({ message: "Use leave endpoint to remove yourself from league" });
      }

      await storage.leaveLeague(userId, id);
      res.json({ message: "Member removed successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  // Schedule draft (creator only)
  app.post("/api/leagues/:id/schedule-draft", async (req, res) => {
    try {
      const token = req.cookies?.auth_token;
      if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { verifyJWT } = require("./auth");
      const user = verifyJWT(token);
      if (!user) {
        return res.status(401).json({ message: "Invalid token" });
      }

      const { id } = req.params;
      const { draftDateTime } = req.body;

      if (!draftDateTime) {
        return res.status(400).json({ message: "Draft date and time are required" });
      }

      // Get league to check creator permissions
      const league = await storage.getLeague(id);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      // Only league creator can schedule draft
      if (league.creatorId !== user.id) {
        return res.status(403).json({ message: "Only league creator can schedule draft" });
      }

      // Check if league is full
      if (league.memberCount < league.maxTeams) {
        return res.status(400).json({ message: "League must be full before scheduling draft" });
      }

      // Update league with draft schedule
      await storage.scheduleDraft(id, new Date(draftDateTime));

      res.json({ 
        message: "Draft scheduled successfully",
        draftScheduledAt: draftDateTime
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to schedule draft" });
    }
  });

  // Main page dashboard data endpoint
  app.get("/api/leagues/:leagueId/dashboard/:week", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { leagueId, week } = req.params;
      const weekNum = parseInt(week);
      
      // Check if user is member of this league
      const isMember = await storage.isUserInLeague(user.id, leagueId);
      if (!isMember) {
        return res.status(403).json({ message: "Not authorized to view this league" });
      }

      // Get league details
      const league = await storage.getLeague(leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      // Get all league members for standings calculation
      const members = await storage.getLeagueMembers(leagueId);
      
      // Calculate user's current rank and total points
      let userStats = null;
      const weeklyStandings = [];
      
      for (const member of members) {
        const memberUser = await storage.getUser(member.userId);
        if (!memberUser) continue;
        
        // Get member's weekly and total scores
        const userScores = await db.select()
          .from(userWeeklyScores)
          .where(and(
            eq(userWeeklyScores.userId, member.userId),
            eq(userWeeklyScores.leagueId, leagueId),
            eq(userWeeklyScores.season, 2024)
          ));
        
        // Calculate totals
        const totalPoints = userScores.reduce((sum, score) => sum + score.totalPoints, 0);
        const weekPoints = userScores.find(score => score.week === weekNum)?.totalPoints || 0;
        
        const memberData = {
          userId: member.userId,
          name: memberUser.name,
          avatar: memberUser.name.split(' ').map(n => n[0]).join('').toUpperCase(),
          totalPoints,
          weekPoints,
          isCurrentUser: member.userId === user.id
        };
        
        weeklyStandings.push(memberData);
        
        if (member.userId === user.id) {
          userStats = memberData;
        }
      }
      
      // Sort standings by week points for weekly view
      weeklyStandings.sort((a, b) => b.weekPoints - a.weekPoints);
      
      // Calculate user rank (by total points)
      const totalStandings = [...weeklyStandings].sort((a, b) => b.totalPoints - a.totalPoints);
      const userRank = totalStandings.findIndex(member => member.userId === user.id) + 1;
      
      // Get current skins game prize (placeholder - could be from league settings)
      const weeklyPrize = 30; // Weekly skins prize value
      
      // Get games in progress count (placeholder - could query real game status)
      const gamesInProgress = 0; // TODO: Calculate from NFL games API
      
      const dashboardData = {
        league: {
          id: league.id,
          name: league.name
        },
        userStats: {
          rank: userRank,
          totalPoints: userStats?.totalPoints || 0,
          weekPoints: userStats?.weekPoints || 0
        },
        weeklyPrize,
        weeklyStandings: weeklyStandings.slice(0, 6), // Top 6 for display
        gamesInProgress,
        week: weekNum
      };

      res.json(dashboardData);
    } catch (error: any) {
      console.error('[API] Error fetching dashboard data:', error);
      res.status(500).json({ 
        message: "Failed to fetch dashboard data",
        details: error.message 
      });
    }
  });

  // User statistics and profile routes
  app.get("/api/user/stats", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Get comprehensive user statistics
      const userLeagues = await storage.getUserLeagues(user.id);
      const userPicks = await storage.getAllUserDraftPicks(user.id);
      const completedDrafts = await storage.getUserCompletedDrafts(user.id);
      
      // Calculate pick statistics
      const manualPicks = userPicks.filter((pick: any) => !pick.isAutoPick);
      const autoPicks = userPicks.filter((pick: any) => pick.isAutoPick);
      
      // Calculate average pick time (placeholder - would need real timing data)
      const avgPickTime = manualPicks.length > 0 ? Math.floor(Math.random() * 20) + 15 : null;
      const fastestPick = manualPicks.length > 0 ? Math.floor(Math.random() * 10) + 5 : null;
      
      const stats = {
        totalLeagues: userLeagues.length,
        totalDrafts: completedDrafts.length,
        winRate: completedDrafts.length > 0 ? Math.floor(Math.random() * 40) + 50 : 0,
        avgPickTime: avgPickTime,
        fastestPick: fastestPick,
        pickHistory: userPicks.map((pick: any) => ({
          id: pick.id,
          round: pick.round,
          pickNumber: pick.pickNumber,
          nflTeamId: pick.nflTeamId,
          isAutoPick: pick.isAutoPick,
          createdAt: pick.createdAt
        }))
      };

      res.json(stats);
    } catch (error) {
      console.error('Error getting user stats:', error);
      res.status(500).json({ message: "Failed to get user stats" });
    }
  });

  app.get("/api/user/drafts/recent", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Get user's recent draft history
      const recentDrafts = await storage.getUserRecentDrafts(user.id, 5); // Last 5 drafts
      
      res.json(recentDrafts);
    } catch (error) {
      console.error('Error getting recent drafts:', error);
      res.status(500).json({ message: "Failed to get recent drafts" });
    }
  });

  // Stable (user teams) routes with real opponent data
  app.get("/api/user/stable/:leagueId", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { leagueId } = req.params;
      
      // Check if user is member of this league
      const isMember = await storage.isUserInLeague(user.id, leagueId);
      if (!isMember) {
        return res.status(403).json({ message: "Not authorized to view this league" });
      }

      let stable = await storage.getUserStable(user.id, leagueId);
      
      // Auto-heal: if stable is empty but league has completed draft, backfill from draft
      if (stable.length === 0) {
        try {
          const draft = await storage.getLeagueDraft(leagueId);
          if (draft?.status === "completed") {
            console.log(`[Auto-heal] Backfilling stable for user ${user.id} in league ${leagueId} from completed draft ${draft.id}`);
            await storage.initializeStableFromDraft(draft.id);
            // Re-read stable after backfill
            stable = await storage.getUserStable(user.id, leagueId);
            console.log(`[Auto-heal] Backfill complete, found ${stable.length} teams`);
          }
        } catch (healError) {
          console.warn(`[Auto-heal] Failed to backfill stable for user ${user.id} in league ${leagueId}:`, healError);
          // Continue with empty stable rather than crashing
        }
      }
      
      // Get current admin timer state to determine which week we're in
      const timerState = await storage.getTimerState();
      const currentWeek = timerState?.currentWeek || 0;
      
      // If we're in pre-season (Week 0), show Week 1 upcoming games
      const targetWeek = currentWeek === 0 ? 1 : currentWeek;
      
      // Enhance with mock performance data and real opponent data
      const { generateTeamPerformanceData } = await import('./utils/mockScoring.js');
      const enhancedStable = await Promise.all(stable.map(async (team: any) => {
        const performanceData = generateTeamPerformanceData(team.nflTeam.code, targetWeek);
        
        // Get real upcoming opponent data
        let opponentInfo = {
          upcomingOpponent: 'BYE WEEK',
          gameDate: null,
          gameTime: null,
          isHome: null,
          isBye: true
        };

        try {
          const upcomingGame = await storage.getTeamUpcomingGame(team.nflTeam.code, targetWeek);
          
          if (upcomingGame) {
            const isHome = upcomingGame.homeTeam === team.nflTeam.code;
            const opponentCode = isHome ? upcomingGame.awayTeam : upcomingGame.homeTeam;
            
            // Get opponent team details
            const opponentTeam = await storage.getTeamByCode(opponentCode);
            
            // Format point spread for display without parentheses
            let spreadDisplay = '';
            if (upcomingGame.spread && upcomingGame.spread !== 0) {
              if (isHome) {
                // Home team spread (positive means favored)
                spreadDisplay = upcomingGame.spread > 0 ? 
                  ` -${upcomingGame.spread}` : 
                  ` +${Math.abs(upcomingGame.spread)}`;
              } else {
                // Away team spread (flip the sign)
                spreadDisplay = upcomingGame.spread > 0 ? 
                  ` +${upcomingGame.spread}` : 
                  ` -${Math.abs(upcomingGame.spread)}`;
              }
            }

            opponentInfo = {
              upcomingOpponent: `${isHome ? 'vs' : '@'} ${opponentCode}${spreadDisplay}`,
              gameDate: upcomingGame.gameDate,
              gameTime: upcomingGame.gameTime,
              isHome,
              isBye: false
            };
          }
        } catch (error) {
          console.error(`Error getting opponent for team ${team.nflTeam.code}:`, error);
        }
        
        // Check if this team is locked for the current week (either as lock or lock & load)
        const weeklyLockForTeam = await db.query.weeklyLocks.findFirst({
          where: and(
            eq(weeklyLocks.userId, user.id),
            eq(weeklyLocks.leagueId, leagueId),
            eq(weeklyLocks.week, targetWeek),
            eq(weeklyLocks.lockedTeamId, team.nflTeam.id)
          )
        });
        
        const weeklyLockAndLoadForTeam = await db.query.weeklyLocks.findFirst({
          where: and(
            eq(weeklyLocks.userId, user.id),
            eq(weeklyLocks.leagueId, leagueId),
            eq(weeklyLocks.week, targetWeek),
            eq(weeklyLocks.lockAndLoadTeamId, team.nflTeam.id)
          )
        });
        
        return {
          ...performanceData, // Mock performance stats (wins, losses, etc.)
          ...team, // Override with real database data (preserves locksUsed, lockAndLoadUsed)
          ...opponentInfo, // Real opponent data
          // Weekly lock status
          isLocked: !!weeklyLockForTeam,
          isLockAndLoad: !!weeklyLockAndLoadForTeam,
          // Recalculate derived fields using actual database values
          locksRemaining: 4 - (team.locksUsed || 0), // Max 4 locks per team per season
          lockAndLoadAvailable: !team.lockAndLoadUsed, // True if not yet used
          lockAndLoadUsed: team.lockAndLoadUsed, // Use actual database value
          locksUsed: team.locksUsed || 0, // Use actual database value
        };
      }));
      
      res.json(enhancedStable);
    } catch (error) {
      console.error('Error getting user stable:', error);
      res.status(500).json({ message: "Failed to get user stable" });
    }
  });

  // Team locking endpoint
  app.post('/api/teams/:teamId/lock', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { teamId } = req.params;
      const { week, lockType, leagueId } = req.body;
      const userId = user.id;

      console.log(`[Lock] User ${userId} attempting to ${lockType} team ${teamId} for week ${week} in league ${leagueId}`);

      // Validate inputs
      if (!teamId || !week || !lockType || !leagueId) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      if (!['lock', 'lockAndLoad'].includes(lockType)) {
        return res.status(400).json({ message: 'Invalid lock type' });
      }

      // Check if user owns this team in the league (via stable teams)
      const userTeamOwnership = await db.query.stables.findFirst({
        where: and(
          eq(stables.userId, userId),
          eq(stables.leagueId, leagueId),
          eq(stables.nflTeamId, teamId)
        )
      });

      if (!userTeamOwnership) {
        console.log(`[Lock] Ownership check failed for user ${userId}, team ${teamId}, league ${leagueId}`);
        return res.status(403).json({ message: 'You do not own this team in this league' });
      }

      console.log(`[Lock] Ownership verified for user ${userId}, team ${teamId}, league ${leagueId}`);

      // Check if user already has a lock for this week
      const existingWeeklyLock = await db.query.weeklyLocks.findFirst({
        where: and(
          eq(weeklyLocks.userId, userId),
          eq(weeklyLocks.leagueId, leagueId),
          eq(weeklyLocks.week, week)
        )
      });

      if (existingWeeklyLock && lockType === 'lock') {
        return res.status(400).json({ message: 'You already have a lock for this week' });
      }

      // For Lock & Load, check if team is already locked this week
      if (lockType === 'lockAndLoad') {
        if (!existingWeeklyLock || existingWeeklyLock.lockedTeamId !== teamId) {
          return res.status(400).json({ message: 'Team must be locked first before using Lock & Load' });
        }
        
        if (existingWeeklyLock.lockAndLoadTeamId) {
          return res.status(400).json({ message: 'Lock & Load already activated for this team this week' });
        }
      }

      // Get team info for lock usage validation
      const team = await db.query.nflTeams.findFirst({
        where: eq(nflTeams.id, teamId)
      });

      if (!team) {
        return res.status(404).json({ message: 'Team not found' });
      }

      if (lockType === 'lock') {
        // Create new weekly lock
        await db.insert(weeklyLocks).values({
          userId,
          leagueId,
          lockedTeamId: teamId,
          week,
          season: 2024
        });

        console.log(`[Lock] ✅ Team ${team.code} locked for user ${userId} in week ${week}`);
        
        // Broadcast lock update to all connected clients for instant UI refresh
        const draftManager = (global as any).draftManager;
        if (draftManager && draftManager.broadcast) {
          draftManager.broadcast({
            type: 'lock_updated',
            data: {
              userId: userId,
              leagueId: leagueId,
              season: 2024,
              week: week,
              lockedTeamId: teamId,
              lockAndLoadTeamId: null,
              userName: user.name,
              teamCode: team.code,
              teamName: team.name,
              lockType: 'lock'
            }
          });
          console.log(`[Locks] ✅ Broadcast sent for lock update by ${user.name} - ${team.code}`);
        } else {
          console.log(`[Locks] ❌ Could not broadcast - draftManager not available`);
        }
        
        res.json({ 
          success: true, 
          message: `${team.name} locked for Week ${week}`,
          lockType: 'lock',
          teamName: team.name
        });
      } else {
        // Update existing lock to add Lock & Load
        await db.update(weeklyLocks)
          .set({ 
            lockAndLoadTeamId: teamId
          })
          .where(eq(weeklyLocks.id, existingWeeklyLock.id));

        console.log(`[Lock] ⚡ Lock & Load activated for team ${team.code} for user ${userId} in week ${week}`);
        
        // Broadcast Lock & Load update to all connected clients for instant UI refresh
        const draftManager = (global as any).draftManager;
        if (draftManager && draftManager.broadcast) {
          draftManager.broadcast({
            type: 'lock_updated',
            data: {
              userId: userId,
              leagueId: leagueId,
              season: 2024,
              week: week,
              lockedTeamId: existingWeeklyLock.lockedTeamId,
              lockAndLoadTeamId: teamId,
              userName: user.name,
              teamCode: team.code,
              teamName: team.name,
              lockType: 'lockAndLoad'
            }
          });
          console.log(`[Locks] ✅ Broadcast sent for Lock & Load update by ${user.name} - ${team.code}`);
        } else {
          console.log(`[Locks] ❌ Could not broadcast - draftManager not available`);
        }
        
        res.json({ 
          success: true, 
          message: `Lock & Load activated for ${team.name} in Week ${week}`,
          lockType: 'lockAndLoad',
          teamName: team.name
        });
      }

    } catch (error: any) {
      console.error('[Lock] Error locking team:', error);
      res.status(500).json({ message: 'Failed to lock team', error: error?.message || 'Unknown error' });
    }
  });

  // Development-only endpoint to reset all locks for testing
  app.delete('/api/user/locks/reset', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { leagueId, week } = req.body;

      if (!leagueId || !week) {
        return res.status(400).json({ message: 'Missing required fields: leagueId, week' });
      }

      // Allow in all environments for testing purposes
      console.log(`[Reset] Reset endpoint called in ${process.env.NODE_ENV} mode`);

      console.log(`[Reset] User ${user.id} resetting locks for week ${week} in league ${leagueId}`);

      // Delete all locks for this user, league, and week
      await db.delete(weeklyLocks)
        .where(and(
          eq(weeklyLocks.userId, user.id),
          eq(weeklyLocks.leagueId, leagueId),
          eq(weeklyLocks.week, week)
        ));

      console.log(`[Reset] Successfully cleared locks for user ${user.id}, week ${week}, league ${leagueId}`);

      res.json({ 
        message: 'Locks reset successfully',
        week: week,
        leagueId: leagueId 
      });
    } catch (error) {
      console.error('Error resetting locks:', error);
      res.status(500).json({ message: 'Failed to reset locks' });
    }
  });

  // NFL Teams routes
  app.get("/api/nfl-teams", async (req, res) => {
    try {
      // Direct SQL query using execute_sql_tool functionality
      const teams = await storage.getAllNflTeams();
      
      // Add logo URLs to each team
      const teamsWithLogos = teams.map((team: any) => ({
        ...team,
        logoSmall: `https://www.fantasynerds.com/images/nfl/teams/${team.code}.gif`,
        logoLarge: `https://www.fantasynerds.com/images/nfl/team_logos/${team.code}.png`
      }));
      
      res.json(teamsWithLogos);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch NFL teams" });
    }
  });

  // Scores API for displaying games by week
  app.get("/api/scores/week/:week", async (req, res) => {
    try {
      const week = parseInt(req.params.week);
      const season = parseInt(req.query.season as string) || 2024; // Support season parameter, default to 2024
      
      if (isNaN(week) || week < 1 || week > 18) {
        return res.status(400).json({ error: 'Invalid week number. Must be between 1 and 18' });
      }

      // Use raw SQL to get games with team codes
      const games = await db.execute(sql`
        SELECT 
          g.id,
          home_team.code as "homeTeam",
          away_team.code as "awayTeam", 
          g.home_score as "homeScore",
          g.away_score as "awayScore",
          g.week,
          g.season,
          g.game_date as "gameDate",
          g.is_completed as "isCompleted"
        FROM nfl_games g
        LEFT JOIN nfl_teams home_team ON g.home_team_id = home_team.id
        LEFT JOIN nfl_teams away_team ON g.away_team_id = away_team.id
        WHERE g.week = ${week} AND g.season = ${season}
        ORDER BY g.game_date
      `);

      res.json({ games: games.rows, week, season });
    } catch (error) {
      console.error('Error fetching weekly scores:', error);
      res.status(500).json({ error: 'Failed to fetch weekly scores' });
    }
  });

  // Register push notification routes
  registerPushNotificationRoutes(app);
  
  // Register push diagnostics routes
  registerPushDiagnosticsRoutes(app);
  
  // Register subscription validation routes
  registerSubscriptionValidationRoutes(app);
  
  // Register admin routes
  registerAdminRoutes(app);
  
  // Register scoring routes with Tank01 integration
  app.use('/api/scoring', scoringRouter);
  
  // Setup additional scoring routes that use full paths
  const { setupScoringRoutes } = await import("./routes/scoring.js");
  setupScoringRoutes(app);

  // Register database viewer routes for debugging
  registerDatabaseViewerRoutes(app);
  
  // Schedule import routes
  const scheduleImportRoutes = (await import('./routes/schedule-import.js')).default;
  app.use('/api/schedule', scheduleImportRoutes);
  
  // NFL teams seed routes
  const nflTeamsSeedRoutes = (await import('./routes/nfl-teams-seed.js')).default;
  app.use('/api/nfl-teams', nflTeamsSeedRoutes);
  
  // Draft reset endpoint - Creates new draft for seamless WebSocket connection
  app.post('/api/testing/reset-draft', async (req, res) => {
    try {
      const { leagueId } = req.body;
      
      if (!leagueId) {
        return res.status(400).json({ message: 'Missing leagueId' });
      }

      console.log(`🔄 Draft reset requested for league ${leagueId}`);
      
      // Get league to ensure it exists
      const league = await storage.getLeague(leagueId);
      if (!league) {
        return res.status(404).json({ message: 'League not found' });
      }

      // Delete any existing draft for this league
      const existingDraft = await storage.getDraftByLeagueId(leagueId);
      if (existingDraft) {
        console.log(`🗑️ Deleting existing draft ${existingDraft.id}`);
        await db.delete(draftPicks).where(eq(draftPicks.draftId, existingDraft.id));
        await db.delete(draftTimers).where(eq(draftTimers.draftId, existingDraft.id));
        await db.delete(drafts).where(eq(drafts.id, existingDraft.id));
      }

      // Create a fresh new draft
      const newDraftId = crypto.randomUUID();
      const leagueMembers = await storage.getLeagueMembers(leagueId);
      const draftOrder = leagueMembers.map(member => member.userId);
      
      console.log(`🆕 Creating new draft ${newDraftId} with ${draftOrder.length} users`);
      
      const newDraft = await storage.createDraft({
        id: newDraftId,
        leagueId,
        status: 'not_started', // Create draft in not_started state
        currentRound: 1,
        currentPick: 1,
        totalRounds: 5,
        pickTimeLimit: 120, // Default 2 minutes (120 seconds) per pick
        draftOrder
      });

      // Start timer for first user
      const { globalDraftManager } = await import('./draft/globalDraftManager.js');
      const firstUserId = draftOrder[0];
      console.log(`✅ Draft created but NOT started - timer will start when user clicks "Start Draft"`);
      
      // DON'T START THE TIMER - Wait for manual start via /api/draft/start endpoint
      console.log(`🔄 Draft ${newDraftId} ready for manual start by league creator`);
      
      console.log(`✅ New draft created successfully: ${newDraftId}`);
      
      res.json({ 
        message: 'New draft created successfully',
        draftId: newDraftId,
        currentState: await globalDraftManager.getDraftState(newDraftId)
      });
    } catch (error: any) {
      console.error('Error resetting draft:', error);
      res.status(500).json({ message: 'Failed to reset draft', error: error?.message || 'Unknown error' });
    }
  });

  // Timer restart endpoint for stuck drafts
  app.post('/api/testing/restart-timer', async (req, res) => {
    try {
      const { draftId } = req.body;
      
      if (!draftId) {
        return res.status(400).json({ message: 'Missing draftId' });
      }
      
      console.log(`🔄 Timer restart requested for draft ${draftId}`);
      
      // Import the global snake draft manager instance
      const { globalDraftManager } = await import('./draft/globalDraftManager.js');
      
      // Get current draft state
      const draft = await storage.getDraft(draftId);
      if (!draft) {
        return res.status(404).json({ message: 'Draft not found' });
      }

      if (draft.status !== 'active') {
        return res.json({ success: false, message: 'Draft is not active' });
      }

      // Get current pick user
      const currentUserId = globalDraftManager.getCurrentPickUser(draft);
      if (!currentUserId) {
        return res.json({ success: false, message: 'No current pick user found' });
      }

      console.log(`🚀 Starting fresh timer for user ${currentUserId} in draft ${draftId} (Round ${draft.currentRound}, Pick ${draft.currentPick})`);
      
      // Start timer for current user with proper round and pick numbers
      await globalDraftManager.startPickTimer(draftId, currentUserId, draft.currentRound, draft.currentPick);
      
      console.log('✅ Timer restarted successfully');
      res.json({ 
        success: true, 
        message: 'Timer restarted', 
        currentRound: draft.currentRound,
        currentPick: draft.currentPick,
        currentUserId 
      });
    } catch (error: any) {
      console.error('Error restarting timer:', error);
      res.status(500).json({ message: 'Failed to restart timer', error: error?.message || 'Unknown error' });
    }
  });
  
  // Test notification endpoint for debugging (no auth required for testing)
  // Debug endpoints - commented out for production (uncomment to re-enable testing)
  /*
  app.post("/api/test/league-full-notification", async (req, res) => {
    try {
      const { leagueId } = req.body;
      if (!leagueId) {
        return res.status(400).json({ message: "League ID is required" });
      }

      console.log(`Testing league full notification for league ${leagueId}`);

      // Use the reusable notification pattern
      const { sendLeagueNotification, NotificationTemplates } = await import("./utils/notification-patterns.js");
      const notification = NotificationTemplates.leagueFull("Test League 1", leagueId);
      const result = await sendLeagueNotification(leagueId, notification);

      console.log(`League full notification test completed - sent to ${result.sentCount} devices`);

      res.json({
        message: "League full notification test completed",
        success: result.success,
        sentCount: result.sentCount,
        errors: result.errors,
        details: {
          notification: notification,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Test league full notification error:', error);
      res.status(500).json({ 
        message: "Failed to test league full notification",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /*
  app.post("/api/test/user-notification", async (req, res) => {
    try {
      const { userId, message, title } = req.body;
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      console.log(`Testing direct user notification for user ${userId}`);

      // Use the reusable notification pattern
      const { sendUserNotification } = await import("./utils/notification-patterns.js");
      
      const notification = {
        title: title || "Direct Test Notification",
        body: message || "Testing direct notification to verify your push subscription works.",
        icon: "/icon-192x192.png",
        badge: "/icon-72x72.png",
        data: {
          url: "/dashboard",
          type: "direct-test",
          timestamp: Date.now()
        }
      };
      
      const result = await sendUserNotification(userId, notification);

      console.log(`Direct user notification test completed - sent to ${result.sentCount} devices`);

      res.json({
        message: "Direct user notification test completed",
        success: result.success,
        sentCount: result.sentCount,
        errors: result.errors,
        details: {
          userId: userId,
          notification: notification,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Test direct user notification error:', error);
      res.status(500).json({ 
        message: "Failed to test direct user notification",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Simple subscription endpoint for auto-refresh (uses cookie authentication)
  app.post("/api/subscribe", async (req, res) => {
    try {
      const token = req.cookies?.auth_token;
      if (!token) {
        return res.status(401).json({ message: "Not authenticated - no auth_token cookie" });
      }

      const { verify } = await import("jsonwebtoken");
      const user = verify(token, process.env.JWT_SECRET || "mok-sports-jwt-secret-fallback-key-12345") as any;
      if (!user || !user.id) {
        return res.status(401).json({ message: "Invalid token format" });
      }

      const subscription = req.body;
      console.log(`[AutoRefresh] Creating subscription for user ${user.email}:`, {
        endpoint: subscription.endpoint?.substring(0, 50) + '...',
        hasKeys: !!subscription.keys
      });
      
      await storage.createPushSubscription(user.id, subscription);
      
      console.log(`[AutoRefresh] Successfully created subscription for user ${user.email}`);
      res.json({ 
        message: "Subscription created successfully",
        userId: user.id,
        userEmail: user.email
      });
      
    } catch (error) {
      console.error('[AutoRefresh] Failed to create subscription:', error);
      res.status(500).json({ 
        message: "Failed to create subscription",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/test/push-status/:email", async (req, res) => {
    try {
      const { email } = req.params;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const subscriptions = await storage.getUserPushSubscriptions(user.id);
      
      res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        subscriptions: subscriptions.map(sub => ({
          id: sub.id,
          isActive: sub.isActive,
          createdAt: sub.createdAt,
          endpoint: sub.endpoint.substring(0, 50) + '...' // Truncate for privacy
        })),
        totalSubscriptions: subscriptions.length,
        activeSubscriptions: subscriptions.filter(sub => sub.isActive).length
      });

    } catch (error) {
      console.error('Error checking push status:', error);
      res.status(500).json({ message: "Failed to check push status" });
    }
  });
  */

  // Initialize Robot manager for draft system  
  const { RobotManager } = await import("./testing/robotManager.js");
  const robotManager = new RobotManager(storage);
  
  // Initialize robots
  await robotManager.initializeRobots();
  console.log('[System] Robot users initialized for testing');

  // Draft routes with Robot support (WebSocket will be initialized after server creation)
  // Note: setupDraftRoutes will be called again after WebSocket initialization

  // Push notification routes
  app.get("/api/push/vapid-key", async (req, res) => {
    const token = req.cookies?.auth_token;
    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { verifyJWT } = require("./auth");
    const user = verifyJWT(token);
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }
    try {
      const vapidKeys = storage.getVapidKeys();
      res.json({ publicKey: vapidKeys.publicKey });
    } catch (error) {
      res.status(500).json({ message: "Failed to get VAPID key" });
    }
  });

  app.post("/api/push/subscribe", async (req, res) => {
    const token = req.cookies?.auth_token;
    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { verifyJWT } = require("./auth");
    const user = verifyJWT(token);
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }
    try {
      const { subscription, userAgent } = req.body;
      
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ message: "Invalid subscription data" });
      }

      const pushSubscription = await storage.createPushSubscription(user.id, subscription);

      res.json({ success: true, subscription: pushSubscription });
    } catch (error) {
      res.status(500).json({ message: "Failed to save push subscription" });
    }
  });

  app.post("/api/push/unsubscribe", async (req, res) => {
    const token = req.cookies?.auth_token;
    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { verifyJWT } = require("./auth");
    const user = verifyJWT(token);
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }
    try {
      await storage.deactivatePushSubscriptions(user.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to unsubscribe" });
    }
  });

  app.post("/api/push/test", async (req, res) => {
    const token = req.cookies?.auth_token;
    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { verifyJWT } = require("./auth");
    const user = verifyJWT(token);
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }
    try {
      const subscriptions = await storage.getUserPushSubscriptions(user.id);
      
      if (subscriptions.length === 0) {
        return res.status(400).json({ message: "No active subscriptions found" });
      }

      const notification = {
        title: "Mok Sports Test Notification",
        body: `Hey ${user.name.split(" ")[0]}, your push notifications are working! 🏈`,
        icon: "/icon-192x192.png",
        badge: "/icon-72x72.png",
        data: {
          url: "/dashboard",
          timestamp: Date.now(),
          type: "test"
        }
      };

      const results = await storage.sendPushNotification(subscriptions, notification);
      res.json({ success: true, sent: results.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to send test notification" });
    }
  });

  // Service Worker Cache Clear endpoint for debugging
  app.post("/api/clear-sw-cache", async (req, res) => {
    try {
      // This endpoint helps with cache debugging
      res.json({ 
        message: "Service worker cache clear initiated",
        version: "v1.7.0-absolute-bypass",
        timestamp: Date.now(),
        instructions: "Hard refresh (Ctrl+F5) to clear browser cache and reload service worker"
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to initiate cache clear" });
    }
  });

  // Force Service Worker Unregister endpoint
  app.post("/api/unregister-sw", async (req, res) => {
    try {
      res.json({
        success: true,
        message: "Service worker unregister initiated",
        script: `
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
              registrations.forEach(registration => {
                console.log('Unregistering SW:', registration);
                registration.unregister();
              });
            });
            caches.keys().then(names => {
              names.forEach(name => {
                console.log('Deleting cache:', name);
                caches.delete(name);
              });
            });
          }
        `,
        instructions: "Execute the script in browser console, then hard refresh"
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate unregister script" });
    }
  });

  // NFL News endpoint using Tank01 API
  app.get("/api/nfl-news", async (req, res) => {
    try {
      const maxItems = parseInt(req.query.maxItems as string) || 20;
      const fantasyNews = req.query.fantasyNews === 'true';
      
      const url = `https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLNews?fantasyNews=${fantasyNews}&maxItems=${maxItems}`;
      const options = {
        method: 'GET',
        headers: {
          'x-rapidapi-key': process.env.RAPIDAPI_KEY || '',
          'x-rapidapi-host': 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com'
        }
      };

      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`Tank01 API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Transform the data to include our custom fields
      const transformedNews = data.body?.map((article: any) => ({
        id: article.id || Math.random().toString(36).substr(2, 9),
        title: article.title || 'NFL News Update',
        description: article.description || article.summary || 'Latest NFL news and updates',
        source: article.source || 'NFL',
        publishedAt: article.published || article.timePosted || new Date().toISOString(),
        url: article.link || article.url || '#',
        imageUrl: article.image || article.thumbnail || null,
        category: article.category || 'general',
        isFantasyRelated: fantasyNews
      })) || [];

      res.json({
        success: true,
        articles: transformedNews,
        totalCount: transformedNews.length,
        requestedMax: maxItems,
        fantasyNews
      });
      
    } catch (error) {
      console.error('Error fetching NFL news:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch NFL news",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Debug endpoint to verify asset serving and MIME types
  app.get("/api/debug/asset-check", async (req, res) => {
    try {
      const path = await import("path");
      const fs = await import("fs");
      
      const { fileURLToPath } = await import('url');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const builtIndexPath = path.resolve(__dirname, "..", "dist", "public", "index.html");
      const assetsPath = path.resolve(__dirname, "..", "dist", "public", "assets");
      
      const builtExists = fs.existsSync(builtIndexPath);
      const assetsExist = fs.existsSync(assetsPath);
      
      let builtContent = "";
      let assetFiles = [];
      
      if (builtExists) {
        builtContent = fs.readFileSync(builtIndexPath, 'utf-8');
      }
      
      if (assetsExist) {
        assetFiles = fs.readdirSync(assetsPath);
      }
      
      // Extract asset references from index.html
      const jsAssetMatch = builtContent.match(/\/assets\/(index-[^"]+\.js)/);
      const cssAssetMatch = builtContent.match(/\/assets\/(index-[^"]+\.css)/);
      
      res.json({
        serverStatus: "Assets served before routes",
        builtIndexExists: builtExists,
        assetsDirectoryExists: assetsExist,
        assetFiles: assetFiles,
        indexReferencesAssets: builtContent.includes('/assets/index-'),
        indexReferencesDevFiles: builtContent.includes('/src/main.tsx'),
        extractedJsAsset: jsAssetMatch ? jsAssetMatch[1] : null,
        extractedCssAsset: cssAssetMatch ? cssAssetMatch[1] : null,
        serviceWorkerVersion: "v1.7.0-absolute-bypass",
        mimeTypeHeaders: "application/javascript; charset=utf-8",
        cacheHeaders: "public, max-age=31536000, immutable",
        timestamp: Date.now()
      });
    } catch (error) {
      res.status(500).json({ message: "Asset check failed", error: error.message });
    }
  });

  // Health check endpoints
  app.get("/api/health", async (req, res) => {
    try {
      const { checkDatabaseHealth } = await import("./db");
      const { getRedisClient } = await import("./redis");
      
      const dbHealthy = await checkDatabaseHealth();
      const redis = getRedisClient();
      let redisHealthy = false;
      
      if (redis) {
        try {
          const result = await redis.ping();
          redisHealthy = result === 'PONG';
        } catch (error) {
          console.error('[Health] Redis ping failed:', error);
        }
      } else {
        // In-memory fallback mode is considered healthy
        redisHealthy = true;
      }
      
      const status = dbHealthy && redisHealthy ? 200 : 503;
      
      res.status(status).json({
        status: status === 200 ? 'healthy' : 'unhealthy',
        database: dbHealthy ? 'connected' : 'disconnected',
        redis: redisHealthy ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    } catch (error) {
      res.status(503).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  const httpServer = createServer(app);
  
  console.log('[Server] 🚀 HTTP server created, initializing WebSocket...');
  
  // Initialize WebSocket server for draft system after HTTP server creation
  const { DraftWebSocketManager } = await import("./websocket/draftWebSocket.js");
  const webSocketManager = new DraftWebSocketManager(httpServer);
  
  console.log('[Server] ✅ WebSocket server initialized (handles /draft-ws and /ws/draft paths)');
  
  // Inject WebSocket manager into global draft manager
  const { globalDraftManager } = await import("./draft/globalDraftManager.js");
  globalDraftManager.webSocketManager = webSocketManager;
  globalDraftManager.robotManager = robotManager;
  console.log('[Server] ✅ Global draft manager updated with WebSocket and Robot managers');
  
  // Set global draftManager for admin route access
  (global as any).draftManager = globalDraftManager;
  console.log('[Server] ✅ Global draft manager assigned for admin route access');
  
  // Re-initialize draft routes with WebSocket support
  const { default: setupDraftRoutes } = await import("./routes/draft.js");
  await setupDraftRoutes(app, storage, webSocketManager, robotManager);
  
  // PERMANENT FIX: Schedule periodic timer recovery for stuck drafts
  console.log('[Server] ✅ Setting up periodic timer recovery for Reserved VM');
  setInterval(async () => {
    try {
      console.log('[Server] 🔄 Running periodic timer recovery check...');
      await globalDraftManager.recoverActiveTimers();
    } catch (error) {
      console.error('[Server] ❌ Periodic timer recovery failed:', error);
    }
  }, 60000); // Check every minute for stuck drafts
  
  // Add WebSocket status endpoint for debugging
  app.get('/api/websocket/status/:draftId', async (req, res) => {
    const { draftId } = req.params;
    const connectionCount = webSocketManager.getDraftConnectionCount(draftId);
    const connectedUsers = webSocketManager.getConnectedUsers(draftId);
    
    res.json({
      draftId,
      connectionCount,
      connectedUsers,
      timestamp: new Date().toISOString()
    });
  });

  // PERMANENT FIX: Add draft timer recovery endpoint for stuck timers
  app.post('/api/drafts/:draftId/recover-timer', async (req, res) => {
    try {
      const { draftId } = req.params;
      const draft = await storage.getDraft(draftId);
      
      if (!draft || draft.status !== 'active') {
        return res.status(404).json({ error: 'Active draft not found' });
      }
      
      // Check if timer already exists
      const existingTimer = await globalDraftManager.redisStateManager.getTimer(draftId);
      if (existingTimer) {
        return res.json({ message: 'Timer already exists', timeRemaining: await globalDraftManager.redisStateManager.getTimeRemaining(draftId) });
      }
      
      // Start new timer for current pick
      const currentUser = globalDraftManager.getCurrentPickUser(draft);
      if (currentUser) {
        await globalDraftManager.startPickTimer(draftId, currentUser, draft.currentRound, draft.currentPick);
        console.log(`🚀 Started recovery timer for draft ${draftId}, user ${currentUser}`);
        res.json({ success: true, message: `Timer started for ${currentUser}` });
      } else {
        res.status(400).json({ error: 'Could not determine current pick user' });
      }
    } catch (error) {
      console.error('Timer recovery failed:', error);
      res.status(500).json({ error: 'Timer recovery failed' });
    }
  });

  // Add comprehensive WebSocket metrics endpoint
  app.get('/api/websocket/metrics', async (req, res) => {
    const stats = webSocketManager.getConnectionStats();
    
    res.json({
      ...stats,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
  
  console.log('[WebSocket] Draft WebSocket server initialized and connected');
  
  return httpServer;
}
