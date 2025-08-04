import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './use-auth';

interface SubscriptionState {
  hasActiveSubscription: boolean;
  subscriptionEndpoint: string | null;
  lastRefreshTime: string | null;
  isRefreshing: boolean;
  refreshCount: number;
  error: string | null;
}

export function useSubscriptionManager() {
  const { user, isAuthenticated } = useAuth();
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [state, setState] = useState<SubscriptionState>({
    hasActiveSubscription: false,
    subscriptionEndpoint: null,
    lastRefreshTime: null,
    isRefreshing: false,
    refreshCount: 0,
    error: null
  });

  const addLog = useCallback((message: string) => {
    console.log(`[SubscriptionManager] ${new Date().toLocaleTimeString()} - ${message}`);
  }, []);

  // Check if we should manage subscriptions
  const shouldManageSubscription = useCallback(() => {
    return (
      isAuthenticated &&
      user &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      Notification.permission === 'granted'
    );
  }, [isAuthenticated, user]);

  // Get current subscription from browser
  const getCurrentSubscription = useCallback(async (): Promise<PushSubscription | null> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (!registration.pushManager) {
        addLog('PushManager not available');
        return null;
      }
      
      const subscription = await registration.pushManager.getSubscription();
      addLog(`Current browser subscription: ${subscription ? 'EXISTS' : 'NONE'}`);
      return subscription;
    } catch (error) {
      addLog(`Failed to get current subscription: ${error}`);
      return null;
    }
  }, [addLog]);

  // Create new push subscription
  const createNewSubscription = useCallback(async (): Promise<PushSubscription | null> => {
    try {
      addLog('Creating new push subscription...');
      
      const registration = await navigator.serviceWorker.ready;
      if (!registration.pushManager) {
        throw new Error('PushManager not available');
      }

      // Get VAPID key from server
      const vapidResponse = await fetch('/api/push/vapid-key');
      if (!vapidResponse.ok) {
        throw new Error('Failed to get VAPID key');
      }
      const { publicKey } = await vapidResponse.json();

      // Create subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey
      });

      addLog(`New subscription created: ${subscription.endpoint.substring(0, 50)}...`);
      return subscription;
    } catch (error) {
      addLog(`Failed to create subscription: ${error}`);
      throw error;
    }
  }, [addLog]);

  // Send subscription to server
  const sendSubscriptionToServer = useCallback(async (subscription: PushSubscription): Promise<boolean> => {
    try {
      addLog('Sending subscription to server...');
      
      // Ensure keys exist before converting
      const p256dhKey = subscription.getKey('p256dh');
      const authKey = subscription.getKey('auth');
      
      if (!p256dhKey || !authKey) {
        throw new Error('Subscription keys missing');
      }

      const subscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...Array.from(new Uint8Array(p256dhKey)))),
          auth: btoa(String.fromCharCode(...Array.from(new Uint8Array(authKey))))
        }
      };

      addLog(`Subscription data: ${JSON.stringify({ endpoint: subscriptionData.endpoint, keysPresent: true })}`);
      
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(subscriptionData)
      });

      addLog(`Server response: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const result = await response.json();
        addLog(`Subscription registered successfully: ${result.message || result.success || 'OK'}`);
        return true;
      } else {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = await response.text() || errorMessage;
        }
        addLog(`Failed to register subscription: ${errorMessage}`);
        return false;
      }
    } catch (error) {
      addLog(`Error sending subscription: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }, [addLog]);

  // Main subscription refresh function
  const refreshSubscription = useCallback(async (force = false): Promise<boolean> => {
    if (!shouldManageSubscription()) {
      addLog('Subscription management not needed - skipping refresh');
      return false;
    }

    if (state.isRefreshing && !force) {
      addLog('Refresh already in progress - skipping');
      return false;
    }

    setState(prev => ({ ...prev, isRefreshing: true, error: null }));
    addLog(`Starting subscription refresh (force: ${force})`);

    try {
      // Check current subscription
      let subscription = await getCurrentSubscription();
      let createdNew = false;
      
      // If no subscription exists or force refresh, create one
      if (!subscription || force) {
        addLog(subscription ? 'Force refresh - creating new subscription' : 'No existing subscription - creating new one');
        
        // Unsubscribe existing if force refresh
        if (subscription && force) {
          try {
            await subscription.unsubscribe();
            addLog('Unsubscribed existing subscription for force refresh');
          } catch (error) {
            addLog(`Warning: Failed to unsubscribe existing: ${error}`);
          }
        }
        
        subscription = await createNewSubscription();
        createdNew = true;
      } else {
        addLog('Found existing subscription - validating with server');
      }

      if (!subscription) {
        throw new Error('Failed to create subscription');
      }

      // Send to server to register/validate
      const serverSuccess = await sendSubscriptionToServer(subscription);
      
      if (serverSuccess) {
        setState(prev => ({
          ...prev,
          hasActiveSubscription: true,
          subscriptionEndpoint: subscription!.endpoint,
          lastRefreshTime: new Date().toISOString(),
          refreshCount: prev.refreshCount + 1,
          isRefreshing: false,
          error: null
        }));
        
        addLog(`Subscription refresh SUCCESS - ${createdNew ? 'New' : 'Existing'} subscription registered`);
        return true;
      } else {
        // If server registration failed, try to clean up the subscription
        if (createdNew && subscription) {
          try {
            await subscription.unsubscribe();
            addLog('Cleaned up failed subscription');
          } catch (cleanupError) {
            addLog(`Warning: Failed to cleanup subscription: ${cleanupError}`);
          }
        }
        throw new Error('Server registration failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Subscription refresh FAILED: ${errorMessage}`);
      
      setState(prev => ({
        ...prev,
        hasActiveSubscription: false,
        isRefreshing: false,
        error: errorMessage
      }));
      
      return false;
    }
  }, [shouldManageSubscription, state.isRefreshing, getCurrentSubscription, createNewSubscription, sendSubscriptionToServer, addLog]);

  // Initialize subscription management
  const initializeSubscription = useCallback(async () => {
    if (!shouldManageSubscription()) {
      addLog('Initialization skipped - requirements not met');
      return;
    }

    addLog('Initializing subscription management...');
    await refreshSubscription(true);
  }, [shouldManageSubscription, refreshSubscription, addLog]);

  // Auto-refresh on app lifecycle events
  useEffect(() => {
    if (!shouldManageSubscription()) {
      addLog('Subscription management requirements not met - waiting for user authentication and permission');
      return;
    }

    // Initial refresh with delay to allow app to settle
    addLog('Initializing subscription management...');
    const initTimer = setTimeout(() => {
      initializeSubscription();
    }, 1000);

    // Refresh on visibility change (app comes to foreground)
    const handleVisibilityChange = () => {
      if (!document.hidden && !state.isRefreshing) {
        addLog('App became visible - checking subscription');
        setTimeout(() => refreshSubscription(false), 2000);
      }
    };

    // Refresh on service worker update/activation
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_ACTIVATED' && !state.isRefreshing) {
        addLog(`Service worker activated (${event.data.version}) - refreshing subscription`);
        setTimeout(() => refreshSubscription(true), 1500);
      }
    };

    const handleServiceWorkerUpdate = () => {
      if (!state.isRefreshing) {
        addLog('Service worker updated - refreshing subscription');
        setTimeout(() => refreshSubscription(true), 2000);
      }
    };

    // Set up periodic refresh (every 10 minutes, less aggressive)
    refreshIntervalRef.current = setInterval(() => {
      if (!state.isRefreshing) {
        addLog('Periodic subscription check');
        refreshSubscription(false);
      }
    }, 10 * 60 * 1000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Listen for service worker updates and messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleServiceWorkerUpdate);
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      clearTimeout(initTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleServiceWorkerUpdate);
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [shouldManageSubscription, initializeSubscription, refreshSubscription, addLog, state.isRefreshing]);

  // Manual refresh function for debugging
  const manualRefresh = useCallback(() => {
    addLog('Manual subscription refresh requested');
    return refreshSubscription(true);
  }, [refreshSubscription, addLog]);

  return {
    ...state,
    manualRefresh,
    canManageSubscriptions: shouldManageSubscription()
  };
}