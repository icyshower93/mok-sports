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

  // Subscribe to push notifications (enhanced)
  app.post("/api/subscribe", authenticateJWT, async (req, res) => {
    try {
      const user = req.user as any;
      const { subscription } = req.body;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Enhanced validation
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ 
          error: "Invalid subscription data",
          details: {
            hasSubscription: !!subscription,
            hasEndpoint: !!subscription?.endpoint,
            hasKeys: !!subscription?.keys,
            hasP256dh: !!subscription?.keys?.p256dh,
            hasAuth: !!subscription?.keys?.auth
          }
        });
      }

      console.log(`[Subscribe] Creating push subscription for user ${user.id}`);
      console.log(`[Subscribe] Endpoint: ${subscription.endpoint.substring(0, 50)}...`);
      console.log(`[Subscribe] Keys valid: p256dh=${!!subscription.keys.p256dh}, auth=${!!subscription.keys.auth}`);

      // Check if this subscription already exists
      const existingSubscriptions = await storage.getUserPushSubscriptions(user.id);
      const existingEndpoint = existingSubscriptions.find(sub => sub.endpoint === subscription.endpoint);
      
      if (existingEndpoint) {
        console.log(`[Subscribe] Subscription already exists for endpoint, updating last used`);
        return res.json({ 
          success: true, 
          message: "Subscription already exists",
          subscriptionId: existingEndpoint.id,
          action: "existing"
        });
      }

      // Create the subscription in the database
      const pushSubscription = await storage.createPushSubscription(user.id, subscription);
      
      console.log(`[Subscribe] Push subscription created with ID: ${pushSubscription.id}`);

      res.json({ 
        success: true, 
        message: "Subscription created successfully",
        subscriptionId: pushSubscription.id,
        action: "created"
      });
    } catch (error) {
      console.error("[Subscribe] Error creating push subscription:", error);
      res.status(500).json({ 
        error: "Failed to create subscription",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Unsubscribe from push notifications
  app.post("/api/unsubscribe", authenticateJWT, async (req, res) => {
    try {
      const user = req.user as any;
      const { endpoint } = req.body;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      if (!endpoint) {
        return res.status(400).json({ error: "Endpoint required" });
      }
      
      await storage.removePushSubscription(user.id, endpoint);
      
      res.json({ 
        success: true,
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

  // Subscribe to push notifications (legacy endpoint)
  app.post("/api/push/subscribe", authenticateJWT, async (req, res) => {
    try {
      const user = req.user as any;
      const { endpoint, keys } = req.body;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Validate subscription data
      if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
        return res.status(400).json({ 
          error: "Invalid subscription data",
          details: "Missing endpoint or keys (p256dh, auth)"
        });
      }

      // Create the subscription object
      const subscription = {
        endpoint,
        keys: {
          p256dh: keys.p256dh,
          auth: keys.auth
        }
      };

      console.log(`[Push] Creating subscription for user ${user.id}: ${endpoint.substring(0, 50)}...`);
      
      await storage.createPushSubscription(user.id, subscription);
      
      console.log(`[Push] Subscription created successfully for user ${user.id}`);
      
      res.status(201).json({ 
        success: true,
        message: "Subscription registered successfully",
        userId: user.id,
        endpoint: endpoint.substring(0, 50) + "..."
      });
      
    } catch (error) {
      console.error('[Push] Subscription creation failed:', error);
      res.status(500).json({ 
        error: "Failed to register subscription",
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

  // Validate existing subscription endpoint
  app.post("/api/push/validate-subscription", authenticateJWT, async (req, res) => {
    try {
      const user = req.user as any;
      const { endpoint } = req.body;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      if (!endpoint) {
        return res.status(400).json({ error: "Endpoint required" });
      }

      // Check if subscription exists in database
      const subscriptions = await storage.getUserPushSubscriptions(user.id);
      const subscription = subscriptions.find(sub => sub.endpoint === endpoint);
      
      if (!subscription) {
        return res.json({ 
          valid: false, 
          reason: "not_found",
          message: "Subscription not found in database" 
        });
      }

      // Test the subscription with a silent notification
      try {
        const testResult = await storage.sendPushNotification([subscription], {
          title: "Subscription Validation",
          body: "Testing push subscription validity",
          icon: "/icon-192x192.png",
          data: {
            url: "/dashboard",
            type: "validation_test",
            timestamp: Date.now(),
            silent: true
          }
        });

        const wasSuccessful = testResult[0]?.success;
        
        res.json({
          valid: wasSuccessful,
          reason: wasSuccessful ? "valid" : "send_failed",
          message: wasSuccessful ? "Subscription is valid" : "Subscription failed validation test",
          testResult: testResult[0]
        });
        
      } catch (error) {
        res.json({
          valid: false,
          reason: "test_error", 
          message: `Validation test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
      
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to validate subscription",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Cleanup invalid subscriptions
  /*
  app.post("/api/push/cleanup-subscriptions", authenticateJWT, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const subscriptions = await storage.getUserPushSubscriptions(user.id);
      const cleanupResults = [];
      
      for (const subscription of subscriptions) {
        try {
          // Test each subscription
          const testResult = await storage.sendPushNotification([subscription], {
            title: "Subscription Cleanup Test",
            body: "Testing subscription validity",
            icon: "/icon-192x192.png", 
            data: {
              url: "/dashboard",
              type: "cleanup_test",
              timestamp: Date.now(),
              silent: true
            }
          });
          
          if (!testResult[0]?.success) {
            // Remove invalid subscription
            await storage.removePushSubscription(user.id, subscription.endpoint);
            cleanupResults.push({
              endpoint: subscription.endpoint.substring(0, 50) + '...',
              action: 'removed',
              reason: testResult[0]?.error || 'failed_test'
            });
          } else {
            cleanupResults.push({
              endpoint: subscription.endpoint.substring(0, 50) + '...',
              action: 'kept',
              reason: 'valid'
            });
          }
        } catch (error) {
          cleanupResults.push({
            endpoint: subscription.endpoint.substring(0, 50) + '...',
            action: 'error',
            reason: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      res.json({
        message: "Subscription cleanup completed",
        totalSubscriptions: subscriptions.length,
        results: cleanupResults
      });
      
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to cleanup subscriptions",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  */

  // Send test notification (for debugging)
  // Debug endpoints - enabled for development testing
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