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

      console.log(`[Push] Sending welcome notification to user ${user.email} (${type})`);
      
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
      
      console.log(`[Push] Welcome notification sent successfully to ${subscriptions.length} devices`);
      
      res.json({
        message: "Welcome notification sent",
        sent: true,
        deviceCount: subscriptions.length
      });
      
    } catch (error) {
      console.error("[Push] Error sending welcome notification:", error);
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
      
      console.log(`[Push] Creating subscription for user ${user.email}`);
      
      await storage.createPushSubscription(user.id, subscription);
      
      res.json({ 
        message: "Subscription created successfully",
        userId: user.id
      });
      
    } catch (error) {
      console.error("[Push] Error creating subscription:", error);
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
      
      console.log(`[Push] Removing subscription for user ${user.email}`);
      
      await storage.removePushSubscription(user.id, endpoint);
      
      res.json({ 
        message: "Subscription removed successfully",
        userId: user.id
      });
      
    } catch (error) {
      console.error("[Push] Error removing subscription:", error);
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
      console.error("[Push] Error getting subscription status:", error);
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
      
      console.log(`[Push] Sending test notification to user ${user.email}`);
      
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
      console.error("[Push] Error sending test notification:", error);
      res.status(500).json({ 
        error: "Failed to send test notification",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}