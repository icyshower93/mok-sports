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
    lastWelcomeNotificationSent: null
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
          isFirstTimeSetup: !parsedState.lastWelcomeNotificationSent
        }));
      } else {
        setState(prev => ({ ...prev, isFirstTimeSetup: true }));
      }
    } catch (error) {
      console.error('[Notifications] Error loading saved state:', error);
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
        lastUpdated: Date.now()
      };
      
      localStorage.setItem(`notification_state_${user.id}`, JSON.stringify(newState));
    } catch (error) {
      console.error('[Notifications] Error saving state:', error);
    }
  }, [user?.id]);

  // Check current permission and subscription status
  const checkCurrentStatus = useCallback(async () => {
    if (!isNotificationSupported || !isPWA) {
      setState(prev => ({ 
        ...prev, 
        permissionStatus: 'denied',
        showEnableBanner: false 
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
      console.error('[Notifications] Error checking subscription:', error);
    }

    setState(prev => ({
      ...prev,
      permissionStatus: permission,
      subscriptionActive,
      showEnableBanner: permission === 'default' || (permission === 'granted' && !subscriptionActive)
    }));

    console.log('[Notifications] Status check:', { permission, subscriptionActive });
  }, [isNotificationSupported, isPWA]);

  // Request permission and setup subscription (POST-LOGIN ONLY)
  const requestPermissionPostLogin = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated || !user || !isNotificationSupported || !isPWA) {
      console.log('[Notifications] Skipping permission request - not authenticated or not supported');
      return false;
    }

    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      console.log('[Notifications] Requesting permission post-login for user:', user.email);
      
      // CRITICAL: This must be called from user interaction context
      // On iOS Safari, this MUST be triggered by user gesture
      const permission = await Notification.requestPermission();
      
      console.log('[Notifications] Permission result:', permission);
      
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
            isProcessing: false
          }));
          
          return true;
        }
      }
      
      setState(prev => ({
        ...prev,
        permissionStatus: permission,
        showEnableBanner: permission !== 'granted',
        isProcessing: false
      }));
      
      return permission === 'granted';
      
    } catch (error) {
      console.error('[Notifications] Error requesting permission:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Permission request failed',
        isProcessing: false
      }));
      return false;
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
        body: JSON.stringify(subscription)
      });

      console.log('[Notifications] Push subscription created successfully');
      return subscription;
      
    } catch (error) {
      console.error('[Notifications] Error creating push subscription:', error);
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
      
      console.log('[Notifications] Welcome notification sent:', type);
    } catch (error) {
      console.error('[Notifications] Error sending welcome notification:', error);
    }
  }, []);

  // Handle post-login flow
  const handlePostLoginFlow = useCallback(async () => {
    if (!isAuthenticated || !user || !isPWA) return;
    
    console.log('[Notifications] Starting post-login flow for user:', user.email);
    
    await checkCurrentStatus();
    
    // If already has permission and subscription, send returning user notification
    if (state.permissionStatus === 'granted' && state.subscriptionActive) {
      console.log('[Notifications] User already has notifications enabled, sending welcome back notification');
      await sendWelcomeNotification('returning');
    }
    
  }, [isAuthenticated, user, isPWA, checkCurrentStatus, state.permissionStatus, state.subscriptionActive, sendWelcomeNotification]);

  // Load state and check status when user logs in
  useEffect(() => {
    if (isAuthenticated && user) {
      loadSavedState();
      handlePostLoginFlow();
    }
  }, [isAuthenticated, user, loadSavedState, handlePostLoginFlow]);

  // Manual enable notifications (requires user interaction)
  const enableNotifications = useCallback(async () => {
    return await requestPermissionPostLogin();
  }, [requestPermissionPostLogin]);

  return {
    ...state,
    isSupported: isNotificationSupported && isPWA,
    enableNotifications, // Call this from button click
    checkCurrentStatus
  };
}