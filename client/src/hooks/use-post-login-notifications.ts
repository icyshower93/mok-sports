import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { usePWADetection } from './use-pwa-detection';

interface PostLoginNotificationState {
  permissionStatus: NotificationPermission;
  subscriptionActive: boolean;
  isFirstTimeSetup: boolean;
  showEnableBanner: boolean;
  isProcessing: boolean;
  error: string | null;
  lastWelcomeNotificationSent: string | null;
}

export function usePostLoginNotifications() {
  const { user, isAuthenticated } = useAuth();
  const { isPWA } = usePWADetection();
  
  const [state, setState] = useState<PostLoginNotificationState>({
    permissionStatus: 'default',
    subscriptionActive: false,
    isFirstTimeSetup: false,
    showEnableBanner: false,
    isProcessing: false,
    error: null,
    lastWelcomeNotificationSent: null,
  });

  // Check if notifications are supported in current environment
  const isNotificationSupported = 'Notification' in window && 
                                 'serviceWorker' in navigator && 
                                 'PushManager' in window;

  // Load saved state from localStorage
  const loadSavedState = useCallback(() => {
    if (!user?.id) return;
    
    try {
      const saved = localStorage.getItem(`notification_state_${user.id}`);
      if (saved) {
        const parsedState = JSON.parse(saved);
        setState(prev => ({
          ...prev,
          lastWelcomeNotificationSent: parsedState.lastWelcomeNotificationSent,
        }));
      } else {
        setState(prev => ({ ...prev, isFirstTimeSetup: true }));
      }
    } catch (error) {
      console.warn('Failed to load notification state:', error);
    }
  }, [user?.id]);

  // Save state to localStorage
  const saveState = useCallback((updates: Partial<PostLoginNotificationState>) => {
    if (!user?.id) return;
    
    try {
      const currentSaved = localStorage.getItem(`notification_state_${user.id}`);
      const existing = currentSaved ? JSON.parse(currentSaved) : {};
      
      const newState = {
        ...existing,
        ...updates,
        userId: user.id,
      };
      
      localStorage.setItem(`notification_state_${user.id}`, JSON.stringify(newState));
    } catch (error) {
      console.warn('Failed to save notification state:', error);
    }
  }, [user?.id]);

  // Check current permission and subscription status
  const checkCurrentStatus = useCallback(async () => {
    if (!isNotificationSupported || !isPWA) {
      setState(prev => ({ 
        ...prev, 
        permissionStatus: 'denied',
      }));
      return;
    }

    const permission = Notification.permission;
    let subscriptionActive = false;

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        subscriptionActive = !!subscription;
      }
    } catch (error) {
      console.warn('Failed to check subscription status:', error);
    }

    setState(prev => ({
      ...prev,
      permissionStatus: permission,
      subscriptionActive,
    }));

  }, [isNotificationSupported, isPWA]);

  // Request permission and setup subscription (POST-LOGIN ONLY)
  const requestPermissionPostLogin = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated || !user || !isNotificationSupported || !isPWA) {
      return false;
    }

    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      // On iOS Safari, this MUST be triggered by user gesture
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        // Create push subscription
        const subscription = await createPushSubscription();
        
        if (subscription) {
          // Send welcome notification for first-time setup
          if (state.isFirstTimeSetup) {
            await sendWelcomeNotification('first-time');
            saveState({ lastWelcomeNotificationSent: new Date().toISOString() });
          } else {
            await sendWelcomeNotification('returning');
          }
          
          setState(prev => ({
            ...prev,
            permissionStatus: permission,
            subscriptionActive: true,
            showEnableBanner: false,
            isFirstTimeSetup: false,
          }));
          
          return true;
        }
      }
      
      setState(prev => ({
        ...prev,
        permissionStatus: permission,
        showEnableBanner: permission !== 'granted',
      }));
      
      return permission === 'granted';
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Permission request failed',
      }));
      return false;
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [isAuthenticated, user, isNotificationSupported, isPWA, state.isFirstTimeSetup, saveState]);

  // Create push subscription
  const createPushSubscription = useCallback(async (): Promise<PushSubscription | null> => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        throw new Error('Service worker not registered');
      }

      // Get VAPID key from server
      const vapidResponse = await fetch('/api/push/vapid-key');
      const { publicKey } = await vapidResponse.json();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey
      });

      // Send subscription to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
            auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!)))
          }
        })
      });

      return subscription;
      
    } catch (error) {
      console.error('Failed to create push subscription:', error);
      return null;
    }
  }, []);

  // Send welcome notification
  const sendWelcomeNotification = useCallback(async (type: 'first-time' | 'returning') => {
    try {
      const message = type === 'first-time' 
        ? 'Welcome to Mok Sports! You\'ll receive updates about your leagues and drafts.'
        : 'You\'re still subscribed for updates! Welcome back to Mok Sports.';

      await fetch('/api/push/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message, type })
      });
      
    } catch (error) {
      console.warn('Failed to send welcome notification:', error);
    }
  }, []);

  // Handle post-login flow
  const handlePostLoginFlow = useCallback(async () => {
    if (!isAuthenticated || !user || !isPWA) return;
    
    await checkCurrentStatus();
    
    // If already has permission and subscription, send returning user notification
    if (state.permissionStatus === 'granted' && state.subscriptionActive) {
      await sendWelcomeNotification('returning');
    }
  }, [isAuthenticated, user, isPWA, state.permissionStatus, state.subscriptionActive, checkCurrentStatus, sendWelcomeNotification]);

  // Auto-check status when user logs in
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    
    loadSavedState();
  }, [isAuthenticated, user, loadSavedState]);

  // Handle post-login notification flow
  useEffect(() => {
    if (isAuthenticated && user && isPWA && state.permissionStatus !== 'denied') {
      handlePostLoginFlow();
    }
  }, [isAuthenticated, user, isPWA, state.permissionStatus, handlePostLoginFlow]);

  return {
    ...state,
    isNotificationSupported,
    requestPermissionPostLogin,
    checkCurrentStatus,
  };
}