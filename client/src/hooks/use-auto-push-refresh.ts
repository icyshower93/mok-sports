import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';

// Constants for push subscription refresh
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa40HI0sVgHbc6vqvRAVy21k7ByHSgFJeTK-J4R-kJ__mNlUJjKZfFfk6tXa-w';

interface AutoPushRefreshOptions {
  enabled?: boolean;
  refreshOnOpen?: boolean;
  refreshOnServiceWorkerActivation?: boolean;
  debug?: boolean;
}

/**
 * Automatic push notification subscription refresh hook for iOS PWA
 * Handles subscription refresh on app open, reinstall, and service worker activation
 */
export function useAutoPushRefresh(options: AutoPushRefreshOptions = {}) {
  const { 
    enabled = true, 
    refreshOnOpen = true, 
    refreshOnServiceWorkerActivation = true,
    debug = false 
  } = options;
  
  const { user } = useAuth();
  const refreshAttempted = useRef(false);
  const subscriptionRefreshPromise = useRef<Promise<void> | null>(null);

  const log = useCallback((message: string, ...args: any[]) => {
    if (debug) {
      console.log(`[AutoPushRefresh] ${message}`, ...args);
    }
  }, [debug]);

  // Always log key lifecycle events for debugging
  useEffect(() => {
    console.log(`[AutoPushRefresh] Hook initialized:`, {
      enabled,
      refreshOnOpen,
      refreshOnServiceWorkerActivation,
      debug,
      userAuthenticated: !!user,
      userEmail: user?.email
    });
  }, [enabled, refreshOnOpen, refreshOnServiceWorkerActivation, debug, user]);

  // Helper function to convert VAPID key
  const urlBase64ToUint8Array = useCallback((base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }, []);

  // Main subscription refresh function
  const refreshPushSubscription = useCallback(async (force: boolean = false): Promise<void> => {
    if (!enabled || !user) {
      log('Skipping refresh - not enabled or user not logged in', { enabled, user: !!user });
      return;
    }

    if (!force && refreshAttempted.current) {
      log('Skipping refresh - already attempted this session (use force=true to override)');
      return;
    }

    // Prevent multiple simultaneous refresh attempts
    if (subscriptionRefreshPromise.current) {
      log('Refresh already in progress, waiting for completion');
      return subscriptionRefreshPromise.current;
    }

    log('Starting push subscription refresh for user:', user.email);

    subscriptionRefreshPromise.current = (async () => {
      try {
        // Check for service worker and push manager support
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          log('Push notifications not supported');
          return;
        }

        // Wait for service worker to be ready
        const registration = await navigator.serviceWorker.ready;
        log('Service worker ready');

        // Step 1: Unsubscribe from existing subscription
        try {
          const existingSubscription = await registration.pushManager.getSubscription();
          if (existingSubscription) {
            log('Found existing subscription, unsubscribing:', existingSubscription.endpoint);
            const unsubscribed = await existingSubscription.unsubscribe();
            log('Unsubscribe result:', unsubscribed);
          } else {
            log('No existing subscription found');
          }
        } catch (error) {
          log('Error during unsubscribe (continuing anyway):', error);
        }

        // Step 2: Check notification permission
        let permission = Notification.permission;
        log('Current notification permission:', permission);

        if (permission === 'default') {
          log('Requesting notification permission');
          permission = await Notification.requestPermission();
          log('Permission request result:', permission);
        }

        if (permission !== 'granted') {
          log('Notification permission not granted, stopping refresh');
          return;
        }

        // Step 3: Create new subscription
        log('Creating new push subscription');
        const newSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        log('New subscription created:', {
          endpoint: newSubscription.endpoint,
          keys: Object.keys(newSubscription.getKey ? {
            p256dh: newSubscription.getKey('p256dh'),
            auth: newSubscription.getKey('auth')
          } : {})
        });

        // Step 4: Send subscription to server
        const subscriptionData = {
          endpoint: newSubscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(newSubscription.getKey('p256dh')!),
            auth: arrayBufferToBase64(newSubscription.getKey('auth')!)
          }
        };

        log('Sending subscription to server:', subscriptionData);
        const response = await fetch('/api/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(subscriptionData)
        });

        const responseText = await response.text();
        log('Server response status:', response.status);
        log('Server response text:', responseText);

        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status} - ${responseText}`);
        }

        let result;
        try {
          result = JSON.parse(responseText);
        } catch (e) {
          result = { message: responseText };
        }
        log('Parsed server response:', result);

        // Mark refresh as completed
        refreshAttempted.current = true;
        log('Push subscription refresh completed successfully');

      } catch (error) {
        console.error('[AutoPushRefresh] Failed to refresh push subscription:', error);
        log('Refresh failed:', error);
      }
    })();

    await subscriptionRefreshPromise.current;
    subscriptionRefreshPromise.current = null;
  }, [enabled, user, log, urlBase64ToUint8Array]);

  // Trigger refresh on user authentication (app open/reopen)
  useEffect(() => {
    if (refreshOnOpen && user) {
      // Always attempt refresh when user is authenticated, ignore previous attempts for debugging
      log('User authenticated, triggering subscription refresh (force mode for debugging)');
      refreshPushSubscription(true); // Force refresh to debug the issue
    }
  }, [user, refreshOnOpen, refreshPushSubscription, log]);

  // Listen for service worker activation events
  useEffect(() => {
    if (!refreshOnServiceWorkerActivation || !('serviceWorker' in navigator)) {
      return;
    }

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'CACHE_UPDATED' || event.data?.type === 'SW_ACTIVATED') {
        log('Service worker activated, triggering subscription refresh');
        refreshPushSubscription(true); // Force refresh on SW activation
      }
    };

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

    // Also listen for service worker state changes
    const handleStateChange = () => {
      navigator.serviceWorker.ready.then(registration => {
        if (registration.active) {
          log('Service worker became active, triggering subscription refresh');
          refreshPushSubscription(true);
        }
      });
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleStateChange);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      navigator.serviceWorker.removeEventListener('controllerchange', handleStateChange);
    };
  }, [refreshOnServiceWorkerActivation, refreshPushSubscription, log]);

  // Listen for page visibility change (app returning to foreground)
  useEffect(() => {
    if (!refreshOnOpen) return;

    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        log('App became visible, checking if subscription refresh is needed');
        // Only refresh if it's been more than 5 minutes since last attempt
        const now = Date.now();
        const lastRefreshTime = sessionStorage.getItem('lastPushRefresh');
        const shouldRefresh = !lastRefreshTime || (now - parseInt(lastRefreshTime)) > 5 * 60 * 1000;
        
        if (shouldRefresh) {
          sessionStorage.setItem('lastPushRefresh', now.toString());
          refreshPushSubscription(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshOnOpen, user, refreshPushSubscription, log]);

  return {
    refreshPushSubscription,
    isRefreshSupported: 'serviceWorker' in navigator && 'PushManager' in window
  };
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}