import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth';

interface SubscriptionState {
  subscription: PushSubscription | null;
  permission: NotificationPermission;
  isLoading: boolean;
  error: string | null;
  isSupported: boolean;
}

interface SubscriptionManager {
  state: SubscriptionState;
  requestPermissionAndSubscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

export function usePersistentPushSubscription(): SubscriptionManager {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    subscription: null,
    permission: 'default',
    isLoading: true,
    error: null,
    isSupported: false
  });

  // Check if push notifications are supported
  const isPushSupported = useCallback(() => {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }, []);

  // Get VAPID public key from server
  const getVapidPublicKey = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/push/vapid-key');
      if (response.ok) {
        const data = await response.json();
        return data.publicKey;
      }
      console.error('Failed to fetch VAPID key:', response.status);
      return null;
    } catch (error) {
      console.error('Error fetching VAPID key:', error);
      return null;
    }
  }, []);

  // Send subscription to backend
  const sendSubscriptionToBackend = useCallback(async (subscription: PushSubscription): Promise<boolean> => {
    if (!user) {
      console.log('[Push Persistence] No user authenticated, skipping backend sync');
      return false;
    }

    try {
      console.log('[Push Persistence] Sending subscription to backend');
      
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          subscription: {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.getKey('p256dh') ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('p256dh')!)) as number[])) : '',
              auth: subscription.getKey('auth') ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('auth')!)) as number[])) : ''
            }
          }
        })
      });

      if (response.ok) {
        console.log('[Push Persistence] Subscription successfully sent to backend');
        return true;
      } else {
        const errorText = await response.text();
        console.error('[Push Persistence] Failed to send subscription to backend:', response.status, errorText);
        return false;
      }
    } catch (error) {
      console.error('[Push Persistence] Error sending subscription to backend:', error);
      return false;
    }
  }, [user]);

  // Create new push subscription
  const createPushSubscription = useCallback(async (): Promise<PushSubscription | null> => {
    try {
      console.log('[Push Persistence] Creating new push subscription');
      
      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = await getVapidPublicKey();
      
      if (!vapidPublicKey) {
        throw new Error('VAPID public key not available');
      }

      // Convert VAPID key to Uint8Array
      const base64String = atob(vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/'));
      const applicationServerKey = new Uint8Array(base64String.length);
      for (let i = 0; i < base64String.length; i++) {
        applicationServerKey[i] = base64String.charCodeAt(i);
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      console.log('[Push Persistence] New subscription created:', {
        endpoint: subscription.endpoint.substring(0, 50) + '...',
        hasKeys: !!(subscription.getKey('p256dh') && subscription.getKey('auth'))
      });

      return subscription;
    } catch (error) {
      console.error('[Push Persistence] Failed to create push subscription:', error);
      return null;
    }
  }, [getVapidPublicKey]);

  // Check existing subscription
  const checkExistingSubscription = useCallback(async (): Promise<PushSubscription | null> => {
    try {
      if (!isPushSupported()) {
        console.log('[Push Persistence] Push notifications not supported');
        return null;
      }

      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      
      if (existingSubscription) {
        console.log('[Push Persistence] Found existing subscription:', {
          endpoint: existingSubscription.endpoint.substring(0, 50) + '...',
          hasKeys: !!(existingSubscription.getKey('p256dh') && existingSubscription.getKey('auth'))
        });
        
        // Validate subscription by sending to backend
        const isValid = await sendSubscriptionToBackend(existingSubscription);
        if (isValid) {
          return existingSubscription;
        } else {
          console.log('[Push Persistence] Existing subscription invalid, removing it');
          await existingSubscription.unsubscribe();
          return null;
        }
      }

      console.log('[Push Persistence] No existing subscription found');
      return null;
    } catch (error) {
      console.error('[Push Persistence] Error checking existing subscription:', error);
      return null;
    }
  }, [isPushSupported, sendSubscriptionToBackend]);

  // Initialize subscription state
  const initializeSubscription = useCallback(async () => {
    if (!user) {
      console.log('[Push Persistence] No user, skipping initialization');
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: null,
      isSupported: isPushSupported(),
      permission: Notification.permission 
    }));

    if (!isPushSupported()) {
      console.log('[Push Persistence] Push notifications not supported');
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      // Check for existing subscription first
      const existingSubscription = await checkExistingSubscription();
      
      setState(prev => ({
        ...prev,
        subscription: existingSubscription,
        permission: Notification.permission,
        isLoading: false
      }));

      if (existingSubscription) {
        console.log('[Push Persistence] Using existing subscription');
      } else if (Notification.permission === 'granted') {
        console.log('[Push Persistence] Permission granted but no subscription, creating new one');
        const newSubscription = await createPushSubscription();
        if (newSubscription) {
          const sent = await sendSubscriptionToBackend(newSubscription);
          if (sent) {
            setState(prev => ({ ...prev, subscription: newSubscription }));
          }
        }
      } else {
        console.log('[Push Persistence] No permission or denied, not creating subscription');
      }
    } catch (error) {
      console.error('[Push Persistence] Failed to initialize subscription:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false 
      }));
    }
  }, [user, isPushSupported, checkExistingSubscription, createPushSubscription, sendSubscriptionToBackend]);

  // Request permission and create subscription
  const requestPermissionAndSubscribe = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported()) {
      console.log('[Push Persistence] Push notifications not supported');
      return false;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Only request permission if it's default
      let permission = Notification.permission;
      if (permission === 'default') {
        console.log('[Push Persistence] Requesting notification permission');
        permission = await Notification.requestPermission();
      }

      setState(prev => ({ ...prev, permission }));

      if (permission === 'granted') {
        console.log('[Push Persistence] Permission granted, creating subscription');
        const subscription = await createPushSubscription();
        
        if (subscription) {
          const sent = await sendSubscriptionToBackend(subscription);
          if (sent) {
            setState(prev => ({ 
              ...prev, 
              subscription, 
              isLoading: false 
            }));
            return true;
          }
        }
      } else {
        console.log('[Push Persistence] Permission denied or not granted');
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    } catch (error) {
      console.error('[Push Persistence] Failed to request permission and subscribe:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false 
      }));
      return false;
    }
  }, [isPushSupported, createPushSubscription, sendSubscriptionToBackend]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<void> => {
    try {
      if (state.subscription) {
        console.log('[Push Persistence] Unsubscribing from push notifications');
        await state.subscription.unsubscribe();
        
        // Notify backend to remove subscription
        if (user) {
          await fetch('/api/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ endpoint: state.subscription.endpoint })
          });
        }
      }

      setState(prev => ({ 
        ...prev, 
        subscription: null 
      }));
    } catch (error) {
      console.error('[Push Persistence] Failed to unsubscribe:', error);
    }
  }, [state.subscription, user]);

  // Refresh subscription (recreate if needed)
  const refreshSubscription = useCallback(async (): Promise<void> => {
    console.log('[Push Persistence] Refreshing subscription');
    await unsubscribe();
    await initializeSubscription();
  }, [unsubscribe, initializeSubscription]);

  // Initialize on mount and when user changes
  useEffect(() => {
    initializeSubscription();
  }, [initializeSubscription]);

  // Handle visibility changes to refresh stale subscriptions
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && state.subscription && user) {
        // Optionally refresh subscription when app becomes visible
        // This helps catch stale subscriptions on iOS
        console.log('[Push Persistence] App became visible, checking subscription validity');
        checkExistingSubscription();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [state.subscription, user, checkExistingSubscription]);

  return {
    state,
    requestPermissionAndSubscribe,
    unsubscribe,
    refreshSubscription
  };
}