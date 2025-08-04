import { useState, useCallback, useRef } from 'react';
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
  const isProcessingRef = useRef(false);
  
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

  // Main subscription refresh function - SINGLE EXECUTION
  const refreshSubscription = useCallback(async (): Promise<boolean> => {
    // Prevent multiple simultaneous executions
    if (isProcessingRef.current) {
      addLog('Subscription refresh already in progress - skipping');
      return false;
    }

    if (!shouldManageSubscription()) {
      addLog('Subscription management not available - skipping');
      return false;
    }

    // Lock processing
    isProcessingRef.current = true;
    setState(prev => ({ ...prev, isRefreshing: true, error: null }));
    addLog('Starting subscription refresh...');

    try {
      // Step 1: Get service worker ready
      const registration = await navigator.serviceWorker.ready;
      if (!registration.pushManager) {
        throw new Error('PushManager not available');
      }

      // Step 2: Check for existing subscription and unsubscribe
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        addLog('Found existing subscription - unsubscribing...');
        await existingSubscription.unsubscribe();
        addLog('Existing subscription unsubscribed');
      }

      // Step 3: Get VAPID key from server
      const vapidResponse = await fetch('/api/push/vapid-key');
      if (!vapidResponse.ok) {
        throw new Error(`Failed to get VAPID key: ${vapidResponse.status}`);
      }
      const { publicKey } = await vapidResponse.json();

      // Step 4: Create new subscription
      addLog('Creating new push subscription...');
      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey
      });

      // Step 5: Prepare subscription data for server
      const p256dhKey = newSubscription.getKey('p256dh');
      const authKey = newSubscription.getKey('auth');
      
      if (!p256dhKey || !authKey) {
        throw new Error('Subscription keys missing');
      }

      const subscriptionData = {
        endpoint: newSubscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...Array.from(new Uint8Array(p256dhKey)))),
          auth: btoa(String.fromCharCode(...Array.from(new Uint8Array(authKey))))
        }
      };

      addLog(`Sending subscription to server: ${newSubscription.endpoint.substring(0, 50)}...`);

      // Step 6: Send to server
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
        addLog(`Subscription registered successfully: ${result.message || 'OK'}`);
        
        // SUCCESS - Update state
        setState(prev => ({
          ...prev,
          hasActiveSubscription: true,
          subscriptionEndpoint: newSubscription.endpoint,
          lastRefreshTime: new Date().toISOString(),
          refreshCount: prev.refreshCount + 1,
          isRefreshing: false,
          error: null
        }));
        
        return true;
      } else {
        // Server registration failed - cleanup subscription
        try {
          await newSubscription.unsubscribe();
          addLog('Cleaned up failed subscription');
        } catch (cleanupError) {
          addLog(`Warning: Failed to cleanup subscription: ${cleanupError}`);
        }
        
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = await response.text() || errorMessage;
        }
        
        throw new Error(`Server registration failed: ${errorMessage}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Subscription refresh FAILED: ${errorMessage}`);
      
      setState(prev => ({
        ...prev,
        hasActiveSubscription: false,
        subscriptionEndpoint: null,
        isRefreshing: false,
        error: errorMessage
      }));
      
      return false;
    } finally {
      // Always unlock processing
      isProcessingRef.current = false;
    }
  }, [shouldManageSubscription, addLog]);

  // Manual refresh for button clicks
  const manualRefresh = useCallback(() => {
    addLog('Manual subscription refresh requested');
    return refreshSubscription();
  }, [refreshSubscription, addLog]);

  // Auto-refresh when permission becomes granted
  const handlePermissionGranted = useCallback(() => {
    if (Notification.permission === 'granted' && !isProcessingRef.current) {
      addLog('Permission granted - creating subscription');
      setTimeout(() => {
        refreshSubscription();
      }, 1000); // Small delay to allow app to settle
    }
  }, [refreshSubscription, addLog]);

  return {
    ...state,
    manualRefresh,
    handlePermissionGranted,
    canManageSubscriptions: shouldManageSubscription()
  };
}