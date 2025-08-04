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
      
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...Array.from(new Uint8Array(subscription.getKey('p256dh')!)))),
            auth: btoa(String.fromCharCode(...Array.from(new Uint8Array(subscription.getKey('auth')!))))
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        addLog(`Subscription sent successfully: ${result.message || 'OK'}`);
        return true;
      } else {
        const error = await response.text();
        addLog(`Failed to send subscription: ${error}`);
        return false;
      }
    } catch (error) {
      addLog(`Error sending subscription: ${error}`);
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
      
      // If no subscription exists, create one
      if (!subscription) {
        addLog('No existing subscription - creating new one');
        subscription = await createNewSubscription();
      } else {
        addLog('Found existing subscription - refreshing with server');
      }

      if (!subscription) {
        throw new Error('Failed to create subscription');
      }

      // Always send to server to ensure it's active
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
        
        addLog(`Subscription refresh SUCCESS - Count: ${state.refreshCount + 1}`);
        return true;
      } else {
        throw new Error('Failed to register subscription with server');
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
  }, [shouldManageSubscription, state.isRefreshing, state.refreshCount, getCurrentSubscription, createNewSubscription, sendSubscriptionToServer, addLog]);

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
      return;
    }

    // Initial refresh
    initializeSubscription();

    // Refresh on visibility change (app comes to foreground)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        addLog('App became visible - refreshing subscription');
        setTimeout(() => refreshSubscription(false), 1000);
      }
    };

    // Refresh on service worker update/activation
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_ACTIVATED') {
        addLog(`Service worker activated (${event.data.version}) - refreshing subscription`);
        setTimeout(() => refreshSubscription(true), 1000);
      }
    };

    const handleServiceWorkerUpdate = () => {
      addLog('Service worker updated - refreshing subscription');
      setTimeout(() => refreshSubscription(true), 2000);
    };

    // Set up periodic refresh (every 5 minutes)
    refreshIntervalRef.current = setInterval(() => {
      addLog('Periodic subscription refresh');
      refreshSubscription(false);
    }, 5 * 60 * 1000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Listen for service worker updates and messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleServiceWorkerUpdate);
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleServiceWorkerUpdate);
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [shouldManageSubscription, initializeSubscription, refreshSubscription, addLog]);

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