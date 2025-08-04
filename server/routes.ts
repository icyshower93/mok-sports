import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { generateJWT, authenticateJWT, isOAuthConfigured } from "./auth";
import { storage } from "./storage";
import { generateJoinCode } from "./utils";
import { insertLeagueSchema } from "@shared/schema";
import { z } from "zod";
import { registerPushNotificationRoutes } from "./routes/push-notifications";
import { registerPushDiagnosticsRoutes } from "./routes/push-diagnostics";
import { registerSubscriptionValidationRoutes } from "./routes/subscription-validation";
import "./auth"; // Initialize passport strategies

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize passport
  app.use(passport.initialize());

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
            path: '/'
          };
          
          
          res.cookie("auth_token", token, cookieOptions);

          // Note: Welcome notifications are now handled by the client-side post-login flow
          // This ensures proper timing and user interaction context for notifications

          res.redirect("/?auth=success");
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

  // Testing login endpoint (development only)
  if (process.env.NODE_ENV === "development") {
    app.post("/api/auth/testing/login", async (req, res) => {
      try {
        const { userId } = req.body;
        
        let user;
        if (userId) {
          user = await storage.getUser(userId);
        } else {
          // Default to Sky Evans for testing
          user = await storage.getUserByEmail("skyevans04@gmail.com");
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
        res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
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

  // Get current user
  app.get("/api/auth/me", (req, res) => {
    const token = req.cookies?.auth_token;
    
    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { verifyJWT } = require("./auth");
    const user = verifyJWT(token);
    
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    res.json(user);
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("auth_token");
    res.json({ message: "Logged out successfully" });
  });

  // League routes
  app.post("/api/leagues", async (req, res) => {
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
      const token = req.cookies?.auth_token;
      if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { verifyJWT } = require("./auth");
      const user = verifyJWT(token);
      if (!user) {
        return res.status(401).json({ message: "Invalid token" });
      }

      const leagues = await storage.getUserLeagues(user.id);
      res.json(leagues);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch leagues" });
    }
  });

  app.post("/api/leagues/join", async (req, res) => {
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
      const league = await storage.getLeague(id);
      
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      // Check if user is member of this league
      const isMember = await storage.isUserInLeague(user.id, id);
      if (!isMember) {
        return res.status(403).json({ message: "Not authorized to view this league" });
      }

      res.json(league);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch league" });
    }
  });

  // Leave league
  app.post("/api/leagues/:id/leave", async (req, res) => {
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

      // Check if user is in the league
      const isMember = await storage.isUserInLeague(user.id, id);
      if (!isMember) {
        return res.status(400).json({ message: "You are not a member of this league" });
      }

      await storage.leaveLeague(user.id, id);
      res.json({ message: "Successfully left league" });
    } catch (error) {
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

  // Register push notification routes
  registerPushNotificationRoutes(app);
  
  // Register push diagnostics routes
  registerPushDiagnosticsRoutes(app);
  
  // Register subscription validation routes
  registerSubscriptionValidationRoutes(app);
  
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

  // Draft routes with Robot support (WebSocket will be added to server after creation)
  const { default: setupDraftRoutes } = await import("./routes/draft.js");
  setupDraftRoutes(app, storage, null, robotManager);

  // WebSocket will be initialized after server creation

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

  const httpServer = createServer(app);
  return httpServer;
}
