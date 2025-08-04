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

  // Validate and clean up invalid subscriptions
  app.post("/api/push/cleanup-subscriptions", authenticateJWT, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      console.log(`[Push Cleanup] Starting subscription cleanup for user ${user.id}`);
      
      // Get all user subscriptions
      const allSubscriptions = await storage.getUserPushSubscriptions(user.id);
      console.log(`[Push Cleanup] Found ${allSubscriptions.length} active subscriptions`);
      
      const cleanupResults = [];
      
      for (const subscription of allSubscriptions) {
        try {
          // Test each subscription with a minimal payload
          const testPayload = {
            title: "Connection Test",
            body: "Testing subscription validity",
            silent: true
          };
          
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dhKey,
              auth: subscription.authKey
            }
          };

          // Attempt to send test notification
          const result = await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(testPayload)
          );
          
          cleanupResults.push({
            subscriptionId: subscription.id,
            status: 'valid',
            statusCode: result.statusCode,
            endpoint: subscription.endpoint.substring(0, 50) + "..."
          });
          
        } catch (error: any) {
          console.log(`[Push Cleanup] Subscription ${subscription.id} failed test: ${error.statusCode} - ${error.message}`);
          
          if (error.statusCode === 410 || error.statusCode === 404) {
            // Deactivate expired/invalid subscriptions
            await storage.removePushSubscription(user.id, subscription.endpoint);
            console.log(`[Push Cleanup] Deactivated subscription ${subscription.id}`);
          }
          
          cleanupResults.push({
            subscriptionId: subscription.id,
            status: error.statusCode === 410 || error.statusCode === 404 ? 'removed' : 'error',
            statusCode: error.statusCode,
            error: error.message,
            endpoint: subscription.endpoint.substring(0, 50) + "..."
          });
        }
      }
      
      // Get updated subscription count
      const remainingSubscriptions = await storage.getUserPushSubscriptions(user.id);
      
      res.json({
        success: true,
        originalCount: allSubscriptions.length,
        remainingCount: remainingSubscriptions.length,
        removedCount: allSubscriptions.length - remainingSubscriptions.length,
        results: cleanupResults
      });

    } catch (error) {
      console.error('[Push Cleanup] Error:', error);
      res.status(500).json({ 
        error: "Failed to cleanup subscriptions",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Force create new subscription (removes old ones first)
  app.post("/api/push/force-resubscribe", authenticateJWT, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      console.log(`[Force Resubscribe] Starting for user ${user.id}`);
      
      // First, deactivate all existing subscriptions
      await storage.deactivatePushSubscriptions(user.id);
      console.log(`[Force Resubscribe] Deactivated all existing subscriptions`);
      
      res.json({
        success: true,
        message: "All existing subscriptions deactivated. Client should now create a new subscription.",
        userId: user.id
      });

    } catch (error) {
      console.error('[Force Resubscribe] Error:', error);
      res.status(500).json({ 
        error: "Failed to force resubscribe",
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

      // Use the enhanced storage method for detailed logging
      const results = await storage.sendPushNotification(subscriptions, testNotification);

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      console.log(`[Push Test] Complete - ${successCount} success, ${failureCount} failures`);

      res.json({
        success: successCount > 0,
        totalSubscriptions: subscriptions.length,
        successCount,
        failureCount,
        results,
        notification: testNotification,
        detailedResults: results.map(r => ({
          subscriptionId: r.subscriptionId,
          success: r.success,
          statusCode: r.statusCode,
          error: r.error,
          responseBody: r.responseBody,
          headers: r.headers,
          endpoint: r.endpoint
        }))
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