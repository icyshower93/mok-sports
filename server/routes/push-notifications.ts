import type { Express } from "express";
import { authenticateJWT } from "../auth";
import { storage } from "../storage";

export function registerPushNotificationRoutes(app: Express) {
  // Send welcome notification after login
  app.post("/api/push/welcome", authenticateJWT, async (req, res) => {
    try {
      const { message, type } = req.body;
      const user = req.user as any;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      
      // Get user's push subscriptions
      const subscriptions = await storage.getUserPushSubscriptions(user.id);
      
      if (subscriptions.length === 0) {
        return res.status(200).json({ 
          message: "No active subscriptions",
          sent: false 
        });
      }

      const notificationData = {
        title: type === 'first-time' ? "Welcome to Mok Sports!" : "Welcome back!",
        body: message || "You're all set to receive updates about your fantasy leagues.",
        icon: "/icon-192x192.png",
        badge: "/icon-72x72.png",
        data: {
          url: "/dashboard",
          type: "welcome",
          timestamp: Date.now(),
          userId: user.id
        }
      };

      // Send notification
      await storage.sendPushNotification(subscriptions, notificationData);
      
      
      res.json({
        message: "Welcome notification sent",
        sent: true,
        deviceCount: subscriptions.length
      });
      
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to send welcome notification",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get VAPID public key
  app.get("/api/push/vapid-key", (req, res) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY || storage.getVapidKeys()?.publicKey;
    
    if (!publicKey) {
      return res.status(500).json({ error: "VAPID key not configured" });
    }
    
    res.json({ publicKey });
  });

  // Subscribe to push notifications
  app.post("/api/push/subscribe", authenticateJWT, async (req, res) => {
    try {
      const user = req.user as any;
      const subscription = req.body;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      
      await storage.createPushSubscription(user.id, subscription);
      
      res.json({ 
        message: "Subscription created successfully",
        userId: user.id
      });
      
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to create subscription",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Unsubscribe from push notifications
  app.post("/api/push/unsubscribe", authenticateJWT, async (req, res) => {
    try {
      const user = req.user as any;
      const { endpoint } = req.body;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      
      await storage.removePushSubscription(user.id, endpoint);
      
      res.json({ 
        message: "Subscription removed successfully",
        userId: user.id
      });
      
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to remove subscription",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get user's subscription status
  app.get("/api/push/status", authenticateJWT, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const subscriptions = await storage.getUserPushSubscriptions(user.id);
      
      res.json({
        userId: user.id,
        subscriptionCount: subscriptions.length,
        hasActiveSubscriptions: subscriptions.length > 0,
        subscriptions: subscriptions.map(sub => ({
          endpoint: sub.endpoint,
          // Don't expose keys for security
          createdAt: sub.createdAt
        }))
      });
      
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to get subscription status",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Send test notification (for debugging)
  app.post("/api/push/test", authenticateJWT, async (req, res) => {
    try {
      const user = req.user as any;
      const { message } = req.body;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      
      const subscriptions = await storage.getUserPushSubscriptions(user.id);
      
      if (subscriptions.length === 0) {
        return res.status(200).json({ 
          message: "No active subscriptions",
          sent: false 
        });
      }

      const notificationData = {
        title: "Test Notification",
        body: message || "This is a test notification from Mok Sports.",
        icon: "/icon-192x192.png",
        badge: "/icon-72x72.png",
        data: {
          url: "/dashboard",
          type: "test",
          timestamp: Date.now()
        }
      };

      await storage.sendPushNotification(subscriptions, notificationData);
      
      res.json({
        message: "Test notification sent",
        sent: true,
        deviceCount: subscriptions.length
      });
      
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to send test notification",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Send league full notification to all members
  app.post("/api/push/league-full", authenticateJWT, async (req, res) => {
    try {
      const user = req.user as any;
      const { leagueId, leagueName } = req.body;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Verify user is the league creator
      const league = await storage.getLeague(leagueId);
      if (!league || league.creatorId !== user.id) {
        return res.status(403).json({ error: "Only league creator can send league notifications" });
      }

      // Get all league members
      const members = league.members || [];
      
      // Get push subscriptions for all members
      const allSubscriptions = [];
      for (const member of members) {
        const subscriptions = await storage.getUserPushSubscriptions(member.id);
        allSubscriptions.push(...subscriptions);
      }
      
      if (allSubscriptions.length === 0) {
        return res.status(200).json({ 
          message: "No active subscriptions among league members",
          sent: false 
        });
      }

      const notificationData = {
        title: "League Full! 🏆",
        body: `${leagueName} is ready! All 6 spots are filled. Time to schedule your draft!`,
        icon: "/icon-192x192.png",
        badge: "/icon-72x72.png",
        data: {
          url: `/league/waiting?id=${leagueId}`,
          type: "league-full",
          timestamp: Date.now(),
          leagueId
        }
      };

      await storage.sendPushNotification(allSubscriptions, notificationData);
      
      res.json({
        message: "League full notification sent",
        sent: true,
        deviceCount: allSubscriptions.length,
        memberCount: members.length
      });
      
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to send league full notification",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}