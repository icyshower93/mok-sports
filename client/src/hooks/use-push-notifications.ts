import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  isIOS: boolean;
  isIOSPWA: boolean;
  needsPWAInstall: boolean;
  requestPermission: () => Promise<void>;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  sendTestNotification: () => Promise<void>;
}

const VAPID_KEY_ENDPOINT = '/api/push/vapid-key';
const SUBSCRIBE_ENDPOINT = '/api/push/subscribe';
const UNSUBSCRIBE_ENDPOINT = '/api/push/unsubscribe';
const TEST_NOTIFICATION_ENDPOINT = '/api/push/test';

export function usePushNotifications(): UsePushNotificationsReturn {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReauthorization, setNeedsReauthorization] = useState(false);

  // Enhanced iOS detection
  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isIOSPWA = isIOS && (
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    ('standalone' in window.navigator && (window.navigator as any).standalone === true)
  );
  const needsPWAInstall = isIOS && !isIOSPWA;

  // Debug logging for iOS detection
  useEffect(() => {
    if (isIOS) {
      console.log('[PWA Debug] iOS detected:', {
        userAgent: navigator.userAgent,
        displayMode: window.matchMedia ? window.matchMedia('(display-mode: standalone)').matches : 'N/A',
        standalone: 'standalone' in window.navigator ? window.navigator.standalone : 'N/A',
        isIOSPWA,
        needsPWAInstall,
        notificationPermission: Notification.permission,
        pushManagerSupported: 'PushManager' in window,
        serviceWorkerSupported: 'serviceWorker' in navigator
      });
    }
  }, [isIOS, isIOSPWA, needsPWAInstall]);

  // Check if push notifications are supported
  const isSupported = typeof window !== 'undefined' && 
    'serviceWorker' in navigator && 
    'PushManager' in window && 
    'Notification' in window &&
    (!isIOS || isIOSPWA); // iOS requires PWA mode

  // Check initial permission status
  useEffect(() => {
    if (isSupported) {
      setPermission(Notification.permission);
      checkSubscriptionStatus();
    }
  }, [isSupported, user]);

  const checkSubscriptionStatus = useCallback(async () => {
    if (!isSupported || !user) {
      setIsSubscribed(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error('Error checking subscription status:', err);
      setIsSubscribed(false);
    }
  }, [isSupported, user]);

  // Define requestPermission function first

  const requestPermission = useCallback(async () => {
    console.log('[PWA Debug] Requesting permission:', {
      isIOS,
      isIOSPWA,
      needsPWAInstall,
      isSupported,
      currentPermission: Notification.permission
    });

    if (needsPWAInstall) {
      setError('To enable notifications on iOS, please add this app to your home screen first, then open it from there.');
      return;
    }
    
    if (!isSupported) {
      const reasons = [];
      if (!('serviceWorker' in navigator)) reasons.push('Service Worker not supported');
      if (!('PushManager' in window)) reasons.push('Push Manager not supported');
      if (!('Notification' in window)) reasons.push('Notification API not supported');
      if (isIOS && !isIOSPWA) reasons.push('iOS requires PWA mode');
      
      setError(`Push notifications are not supported: ${reasons.join(', ')}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[PWA Debug] Calling Notification.requestPermission()');
      const result = await Notification.requestPermission();
      console.log('[PWA Debug] Permission result:', result);
      setPermission(result);

      if (result === 'denied') {
        setError('Notification permission was denied. Please enable notifications in your device settings.');
      } else if (result === 'granted') {
        console.log('[PWA Debug] Permission granted successfully');
      }
    } catch (err) {
      console.error('Error requesting permission:', err);
      setError(`Failed to request notification permission: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, isIOS, isIOSPWA, needsPWAInstall]);

  const getVapidKey = useCallback(async (): Promise<string> => {
    const response = await fetch(VAPID_KEY_ENDPOINT, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to get VAPID key');
    }

    const data = await response.json();
    return data.publicKey;
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported || permission !== 'granted' || !user) {
      setError('Cannot subscribe: missing requirements');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Ensure service worker is registered and ready
      const registration = await navigator.serviceWorker.ready;

      // Get VAPID public key from server
      const vapidKey = await getVapidKey();

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      // Send subscription to server
      const response = await fetch(SUBSCRIBE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription to server');
      }

      setIsSubscribed(true);
    } catch (err) {
      console.error('Error subscribing to push notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to subscribe to push notifications');
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, permission, user, getVapidKey]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported || !user) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Unsubscribe from browser
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
      }

      // Notify server
      const response = await fetch(UNSUBSCRIBE_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        console.warn('Failed to notify server of unsubscription');
      }

      setIsSubscribed(false);
    } catch (err) {
      console.error('Error unsubscribing from push notifications:', err);
      setError('Failed to unsubscribe from push notifications');
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user]);

  const sendTestNotification = useCallback(async () => {
    if (!isSubscribed || !user) {
      setError('Must be subscribed to send test notification');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(TEST_NOTIFICATION_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send test notification');
      }
    } catch (err) {
      console.error('Error sending test notification:', err);
      setError(err instanceof Error ? err.message : 'Failed to send test notification');
    } finally {
      setIsLoading(false);
    }
  }, [isSubscribed, user]);

  // Auto-request permission for iOS PWA users on app load
  useEffect(() => {
    if (isIOS && isIOSPWA && isSupported && user && permission === 'default') {
      console.log('[PWA Debug] iOS PWA detected with user logged in, auto-requesting permission in 3 seconds');
      // Longer delay to ensure app is fully loaded and user sees the interface
      const timer = setTimeout(() => {
        console.log('[PWA Debug] Triggering auto permission request now');
        requestPermission();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isIOS, isIOSPWA, isSupported, user, permission, requestPermission]);

  // Check if notifications need re-enabling (PWA reinstall scenario)
  useEffect(() => {
    if (isIOSPWA && 'serviceWorker' in navigator && 'PushManager' in window) {
      // Check if we previously had permission but lost subscription
      const checkReinstallStatus = async () => {
        const permission = Notification.permission;
        if (permission === 'granted') {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (!subscription && localStorage.getItem('was-subscribed') === 'true') {
            // PWA was reinstalled, need to re-subscribe
            console.log('PWA reinstall detected, subscription needs renewal');
            setNeedsReauthorization(true);
          }
        }
      };
      checkReinstallStatus();
    }
  }, [isIOSPWA]);

  // Track subscription status in localStorage
  useEffect(() => {
    if (isSubscribed) {
      localStorage.setItem('was-subscribed', 'true');
    }
  }, [isSubscribed]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    isIOS,
    isIOSPWA,
    needsPWAInstall,
    needsReauthorization,
    requestPermission,
    subscribe,
    unsubscribe,
    sendTestNotification,
  };
}