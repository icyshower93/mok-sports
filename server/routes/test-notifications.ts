import type { Express } from "express";
import { authenticateJWT } from "../auth";
import { sendLeagueNotification, sendUserNotification, NotificationTemplates } from "../utils/notification-patterns";

export function registerTestNotificationRoutes(app: Express) {
  // Test league full notification manually
  app.post("/api/test/league-full-notification", authenticateJWT, async (req, res) => {
    try {
      const user = req.user as any;
      const { leagueId } = req.body;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      if (!leagueId) {
        return res.status(400).json({ error: "League ID is required" });
      }

      console.log(`Testing league full notification for league ${leagueId} by user ${user.id}`);
      
      // Create notification using the reusable pattern
      const notification = NotificationTemplates.leagueFull("Test League 1", leagueId);
      const result = await sendLeagueNotification(leagueId, notification);
      
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
        error: "Failed to test league full notification",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Test user-specific notification
  app.post("/api/test/user-notification", authenticateJWT, async (req, res) => {
    try {
      const user = req.user as any;
      const { message, title } = req.body;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      console.log(`Testing user notification for user ${user.id}`);
      
      // Create custom notification for this user
      const notification = {
        title: title || "Test Notification",
        body: message || "This is a test notification to verify your setup works.",
        icon: "/icon-192x192.png",
        badge: "/icon-72x72.png",
        data: {
          url: "/dashboard",
          type: "test-user",
          timestamp: Date.now()
        }
      };
      
      const result = await sendUserNotification(user.id, notification);
      
      res.json({
        message: "User notification test completed",
        success: result.success,
        sentCount: result.sentCount,
        errors: result.errors,
        details: {
          userId: user.id,
          notification: notification,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('Test user notification error:', error);
      res.status(500).json({ 
        error: "Failed to test user notification",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}