import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission;
  subscription: PushSubscription | null;
  isSubscribing: boolean;
  error: string | null;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: 'default',
    subscription: null,
    isSubscribing: false,
    error: null
  });

  useEffect(() => {
    const checkSupport = async () => {
      const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
      const permission: NotificationPermission = 'Notification' in window ? Notification.permission : 'denied';
      
      setState(prev => ({
        ...prev,
        isSupported,
        permission
      }));

      if (isSupported && 'serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          setState(prev => ({
            ...prev,
            subscription
          }));
        } catch (error) {
          console.error('Error getting push subscription:', error);
        }
      }
    };

    checkSupport();
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      setState(prev => ({ ...prev, error: 'Notifications not supported' }));
      return false;
    }

    setState(prev => ({ ...prev, isSubscribing: true, error: null }));

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));
      
      if (permission === 'granted') {
        return true;
      } else {
        setState(prev => ({ ...prev, error: 'Notification permission denied' }));
        return false;
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to request permission' 
      }));
      return false;
    } finally {
      setState(prev => ({ ...prev, isSubscribing: false }));
    }
  }, []);

  const subscribe = useCallback(async (): Promise<PushSubscription | null> => {
    if (!state.isSupported || !user) {
      return null;
    }

    setState(prev => ({ ...prev, isSubscribing: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          'BEl62iUYgUivxIkv69yViEuiBIa40HI0sVgHbc6vqvRAVy21k7ByHSgFJeTK-J4R-kJ__mNlUJjKZfFfk6tXa-w'
        )
      });

      setState(prev => ({ ...prev, subscription }));
      return subscription;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to subscribe' 
      }));
      return null;
    } finally {
      setState(prev => ({ ...prev, isSubscribing: false }));
    }
  }, [state.isSupported, user]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!state.subscription) {
      return false;
    }

    setState(prev => ({ ...prev, isSubscribing: true, error: null }));

    try {
      const success = await state.subscription.unsubscribe();
      if (success) {
        setState(prev => ({ ...prev, subscription: null }));
      }
      return success;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to unsubscribe' 
      }));
      return false;
    } finally {
      setState(prev => ({ ...prev, isSubscribing: false }));
    }
  }, [state.subscription]);

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe
  };
}

function urlBase64ToUint8Array(base64String: string) {
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
}