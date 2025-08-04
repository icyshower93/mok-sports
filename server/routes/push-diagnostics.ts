import type { Express } from "express";
import { authenticateJWT } from "../auth";
import { storage } from "../storage";
import webpush from "web-push";

export function registerPushDiagnosticsRoutes(app: Express) {
  // Comprehensive push notification diagnostics
  app.get("/api/push/diagnostics", authenticateJWT, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // 1. Check VAPID configuration
      const vapidKeys = storage.getVapidKeys();
      const hasVapidKeys = !!(vapidKeys?.publicKey && vapidKeys?.privateKey);
      
      // 2. Check user's push subscriptions
      const subscriptions = await storage.getUserPushSubscriptions(user.id);
      
      // 3. Check if webpush is properly configured
      let webpushConfigured = false;
      try {
        if (hasVapidKeys) {
          webpush.setVapidDetails(
            'mailto:mokfantasysports@gmail.com',
            vapidKeys.publicKey,
            vapidKeys.privateKey
          );
          webpushConfigured = true;
        }
      } catch (error) {
        console.error('VAPID configuration error:', error);
      }

      // 4. Test subscription validity
      const subscriptionTests = [];
      for (const subscription of subscriptions) {
        try {
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dhKey,
              auth: subscription.authKey
            }
          };

          // Test if subscription is valid format
          const isValidFormat = !!(
            pushSubscription.endpoint &&
            pushSubscription.keys?.p256dh &&
            pushSubscription.keys?.auth
          );

          subscriptionTests.push({
            id: subscription.id,
            endpoint: subscription.endpoint.substring(0, 50) + "...",
            isValidFormat,
            isActive: subscription.isActive,
            createdAt: subscription.createdAt,
            lastUsed: subscription.lastUsed
          });
        } catch (error) {
          subscriptionTests.push({
            id: subscription.id,
            endpoint: subscription.endpoint.substring(0, 50) + "...",
            error: error instanceof Error ? error.message : 'Unknown error',
            isActive: subscription.isActive
          });
        }
      }

      // 5. Environment checks
      const environment = {
        nodeEnv: process.env.NODE_ENV,
        hasVapidPublic: !!process.env.VAPID_PUBLIC_KEY,
        hasVapidPrivate: !!process.env.VAPID_PRIVATE_KEY,
        protocol: req.protocol,
        host: req.get('host'),
        isHttps: req.secure || req.get('x-forwarded-proto') === 'https'
      };

      res.json({
        user: {
          id: user.id,
          email: user.email
        },
        vapid: {
          configured: hasVapidKeys,
          publicKeyLength: vapidKeys?.publicKey?.length || 0
        },
        webpush: {
          configured: webpushConfigured
        },
        subscriptions: {
          count: subscriptions.length,
          active: subscriptions.filter(s => s.isActive).length,
          tests: subscriptionTests
        },
        environment,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Diagnostics error:', error);
      res.status(500).json({ 
        error: "Failed to run diagnostics",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Test push notification delivery with detailed logging
  app.post("/api/push/test-delivery", authenticateJWT, async (req, res) => {
    try {
      const user = req.user as any;
      const { message = "Test notification delivery" } = req.body;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      console.log(`[Push Test] Starting delivery test for user ${user.id}`);
      
      // Get user's subscriptions
      const subscriptions = await storage.getUserPushSubscriptions(user.id);
      console.log(`[Push Test] Found ${subscriptions.length} subscriptions`);
      
      if (subscriptions.length === 0) {
        return res.json({ 
          success: false,
          error: "No active subscriptions found",
          subscriptions: 0
        });
      }

      // Test notification payload
      const testNotification = {
        title: "🔧 Push Test",
        body: message,
        icon: "/icon-192x192.png",
        badge: "/icon-72x72.png",
        tag: "test-delivery",
        requireInteraction: false,
        data: {
          url: "/dashboard",
          type: "test-delivery",
          timestamp: Date.now(),
          testId: Math.random().toString(36).substring(7)
        }
      };

      console.log(`[Push Test] Sending notification:`, JSON.stringify(testNotification, null, 2));

      // Send notifications with detailed tracking
      const results = [];
      for (let i = 0; i < subscriptions.length; i++) {
        const subscription = subscriptions[i];
        console.log(`[Push Test] Testing subscription ${i + 1}/${subscriptions.length}: ${subscription.endpoint.substring(0, 50)}...`);
        
        try {
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dhKey,
              auth: subscription.authKey
            }
          };

          const startTime = Date.now();
          const result = await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(testNotification)
          );
          const duration = Date.now() - startTime;

          console.log(`[Push Test] Subscription ${i + 1} SUCCESS - Duration: ${duration}ms, Status: ${result.statusCode}`);
          
          results.push({
            subscriptionId: subscription.id,
            success: true,
            statusCode: result.statusCode,
            duration,
            endpoint: subscription.endpoint.substring(0, 50) + "..."
          });

          // Update last used timestamp
          await storage.getUserPushSubscriptions(user.id); // This will update lastUsed

        } catch (error: any) {
          console.error(`[Push Test] Subscription ${i + 1} FAILED:`, error);
          
          results.push({
            subscriptionId: subscription.id,
            success: false,
            error: error.message,
            statusCode: error.statusCode || null,
            endpoint: subscription.endpoint.substring(0, 50) + "..."
          });

          // If subscription is invalid, deactivate it
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`[Push Test] Deactivating invalid subscription ${subscription.id}`);
            // Note: Deactivation logic would be implemented in storage layer
          }
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      console.log(`[Push Test] Complete - ${successCount} success, ${failureCount} failures`);

      res.json({
        success: successCount > 0,
        totalSubscriptions: subscriptions.length,
        successCount,
        failureCount,
        results,
        notification: testNotification
      });

    } catch (error) {
      console.error('[Push Test] Fatal error:', error);
      res.status(500).json({ 
        error: "Failed to test notification delivery",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Test league full notification manually
  app.post("/api/push/test-league-full", authenticateJWT, async (req, res) => {
    try {
      const user = req.user as any;
      const { leagueId } = req.body;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      console.log(`[League Test] Testing league full notification for league ${leagueId}`);

      // Import the notification pattern
      const { sendLeagueNotification, NotificationTemplates } = await import("../utils/notification-patterns.js");
      
      // Get league info
      const league = await storage.getLeague(leagueId);
      if (!league) {
        return res.status(404).json({ error: "League not found" });
      }

      // Create test notification
      const notification = NotificationTemplates.leagueFull(league.name, league.id);
      console.log(`[League Test] Notification template:`, notification);

      // Send notification
      const result = await sendLeagueNotification(league.id, notification);
      
      console.log(`[League Test] Result:`, result);

      res.json({
        success: result.success,
        league: {
          id: league.id,
          name: league.name,
          memberCount: league.memberCount || 0
        },
        notification,
        result
      });

    } catch (error) {
      console.error('[League Test] Error:', error);
      res.status(500).json({ 
        error: "Failed to test league notification",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}