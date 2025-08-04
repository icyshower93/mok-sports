import type { Express } from "express";
import { authenticateJWT } from "../auth";
import { storage } from "../storage";
import webpush from "web-push";

export function registerSubscriptionValidationRoutes(app: Express) {
  // Comprehensive subscription validation endpoint
  app.post("/api/push/validate-subscription", authenticateJWT, async (req, res) => {
    try {
      const user = req.user as any;
      const { subscription } = req.body;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      console.log(`[Subscription Validation] Starting validation for user ${user.id}`);
      console.log(`[Subscription Validation] Subscription data:`, {
        hasEndpoint: !!subscription?.endpoint,
        hasKeys: !!subscription?.keys,
        hasP256dh: !!subscription?.keys?.p256dh,
        hasAuth: !!subscription?.keys?.auth,
        endpointLength: subscription?.endpoint?.length || 0,
        p256dhLength: subscription?.keys?.p256dh?.length || 0,
        authLength: subscription?.keys?.auth?.length || 0
      });

      const validationResults = {
        isValid: true,
        errors: [] as string[],
        warnings: [] as string[],
        details: {
          endpoint: null as any,
          keys: null as any,
          format: null as any,
          compatibility: null as any
        }
      };

      // 1. Basic structure validation
      if (!subscription) {
        validationResults.isValid = false;
        validationResults.errors.push("Missing subscription object");
        return res.json(validationResults);
      }

      // 2. Endpoint validation
      if (!subscription.endpoint) {
        validationResults.isValid = false;
        validationResults.errors.push("Missing endpoint");
      } else {
        try {
          const endpointUrl = new URL(subscription.endpoint);
          validationResults.details.endpoint = {
            url: subscription.endpoint,
            protocol: endpointUrl.protocol,
            hostname: endpointUrl.hostname,
            isHttps: endpointUrl.protocol === 'https:',
            isFirebase: subscription.endpoint.includes('fcm.googleapis.com'),
            isMozilla: subscription.endpoint.includes('updates.push.services.mozilla.com'),
            isApple: subscription.endpoint.includes('web.push.apple.com')
          };

          if (!validationResults.details.endpoint.isHttps) {
            validationResults.warnings.push("Endpoint is not HTTPS");
          }
        } catch (error) {
          validationResults.isValid = false;
          validationResults.errors.push(`Invalid endpoint URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 3. Keys validation
      if (!subscription.keys) {
        validationResults.isValid = false;
        validationResults.errors.push("Missing keys object");
      } else {
        const { p256dh, auth } = subscription.keys;
        
        validationResults.details.keys = {
          hasP256dh: !!p256dh,
          hasAuth: !!auth,
          p256dhLength: p256dh?.length || 0,
          authLength: auth?.length || 0,
          p256dhValid: false,
          authValid: false
        };

        if (!p256dh) {
          validationResults.isValid = false;
          validationResults.errors.push("Missing p256dh key");
        } else {
          // Validate p256dh key format (should be base64)
          try {
            const decoded = atob(p256dh);
            validationResults.details.keys.p256dhValid = decoded.length === 65; // 65 bytes for uncompressed key
            if (!validationResults.details.keys.p256dhValid) {
              validationResults.warnings.push(`p256dh key length unexpected: ${decoded.length} bytes (expected 65)`);
            }
          } catch (error) {
            validationResults.isValid = false;
            validationResults.errors.push("p256dh key is not valid base64");
          }
        }

        if (!auth) {
          validationResults.isValid = false;
          validationResults.errors.push("Missing auth key");
        } else {
          // Validate auth key format (should be base64)
          try {
            const decoded = atob(auth);
            validationResults.details.keys.authValid = decoded.length === 16; // 16 bytes for auth key
            if (!validationResults.details.keys.authValid) {
              validationResults.warnings.push(`auth key length unexpected: ${decoded.length} bytes (expected 16)`);
            }
          } catch (error) {
            validationResults.isValid = false;
            validationResults.errors.push("auth key is not valid base64");
          }
        }
      }

      // 4. Format validation for web-push library
      if (validationResults.isValid) {
        try {
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth
            }
          };

          // Test JSON serialization
          const serialized = JSON.stringify(pushSubscription);
          validationResults.details.format = {
            canSerialize: true,
            serializedLength: serialized.length,
            webPushCompatible: true
          };

          console.log(`[Subscription Validation] Format validation passed`);
        } catch (error) {
          validationResults.isValid = false;
          validationResults.errors.push(`Format validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 5. iOS/Safari specific validation
      if (validationResults.details.endpoint?.isApple) {
        validationResults.details.compatibility = {
          platform: 'iOS Safari',
          notes: [
            'iOS Safari requires HTTPS in production',
            'PWA must be installed to home screen for reliable notifications',
            'Notifications may be throttled in background'
          ]
        };
      } else if (validationResults.details.endpoint?.isFirebase) {
        validationResults.details.compatibility = {
          platform: 'Chrome/Android',
          notes: [
            'Firebase Cloud Messaging endpoint',
            'Generally reliable across platforms'
          ]
        };
      } else if (validationResults.details.endpoint?.isMozilla) {
        validationResults.details.compatibility = {
          platform: 'Firefox',
          notes: [
            'Mozilla push service',
            'Works across desktop and mobile Firefox'
          ]
        };
      }

      console.log(`[Subscription Validation] Validation complete - Valid: ${validationResults.isValid}, Errors: ${validationResults.errors.length}, Warnings: ${validationResults.warnings.length}`);

      res.json(validationResults);

    } catch (error) {
      console.error('[Subscription Validation] Error:', error);
      res.status(500).json({ 
        error: "Failed to validate subscription",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Test subscription with minimal payload
  app.post("/api/push/test-subscription", authenticateJWT, async (req, res) => {
    try {
      const user = req.user as any;
      const { subscription } = req.body;
      
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      console.log(`[Subscription Test] Testing subscription for user ${user.id}`);

      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ 
          error: "Invalid subscription data",
          received: {
            hasSubscription: !!subscription,
            hasEndpoint: !!subscription?.endpoint,
            hasKeys: !!subscription?.keys
          }
        });
      }

      const testPayload = {
        title: "Subscription Test",
        body: "Testing subscription validity",
        silent: true,
        tag: "subscription-test"
      };

      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth
          }
        };

        console.log(`[Subscription Test] Sending test notification`);
        
        const result = await webpush.sendNotification(
          pushSubscription,
          JSON.stringify(testPayload)
        );

        console.log(`[Subscription Test] SUCCESS - Status: ${result.statusCode}`);

        res.json({
          success: true,
          statusCode: result.statusCode,
          headers: result.headers,
          body: result.body,
          payload: testPayload
        });

      } catch (error: any) {
        console.error(`[Subscription Test] FAILED:`, error);
        
        res.json({
          success: false,
          error: error.message,
          statusCode: error.statusCode,
          responseBody: error.body,
          headers: error.headers,
          payload: testPayload,
          errorDetails: {
            type: error.constructor.name,
            stack: error.stack
          }
        });
      }

    } catch (error) {
      console.error('[Subscription Test] Error:', error);
      res.status(500).json({ 
        error: "Failed to test subscription",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}