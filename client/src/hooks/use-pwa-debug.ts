import { useState, useEffect } from 'react';

interface PWADebugInfo {
  isStandalone: boolean;
  isPWA: boolean;
  isIOSDevice: boolean;
  notificationPermission: NotificationPermission;
  pushSupported: boolean;
  serviceWorkerRegistered: boolean;
  hasActiveSubscription: boolean;
  subscriptionEndpoint: string | null;
  environment: 'development' | 'production';
  isHTTPS: boolean;
  userAgent: string;
}

export function usePWADebug() {
  const [debugInfo, setDebugInfo] = useState<PWADebugInfo>({
    isStandalone: false,
    isPWA: false,
    isIOSDevice: false,
    notificationPermission: 'default',
    pushSupported: false,
    serviceWorkerRegistered: false,
    hasActiveSubscription: false,
    subscriptionEndpoint: null,
    environment: 'development',
    isHTTPS: false,
    userAgent: ''
  });

  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(`[PWA DEBUG] ${logEntry}`);
    setLogs(prev => [...prev.slice(-19), logEntry]); // Keep last 20 logs
  };

  const checkPWAStatus = async () => {
    try {
      // Check standalone mode (PWA installed)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone === true;
      
      // Check if iOS device
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      
      // Check HTTPS
      const isHTTPS = location.protocol === 'https:';
      
      // Check environment
      const environment: 'development' | 'production' = location.hostname === 'localhost' || location.hostname === '127.0.0.1' 
        ? 'development' : 'production';
      
      // Check notification permission
      const notificationPermission = 'Notification' in window ? Notification.permission : 'denied';
      
      // Check push support
      const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window;
      
      // Check service worker
      let serviceWorkerRegistered = false;
      let hasActiveSubscription = false;
      let subscriptionEndpoint = null;
      
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          serviceWorkerRegistered = !!registration;
          
          if (registration && registration.pushManager) {
            const subscription = await registration.pushManager.getSubscription();
            hasActiveSubscription = !!subscription;
            subscriptionEndpoint = subscription?.endpoint || null;
          }
        } catch (error) {
          addLog(`Service worker check failed: ${error}`);
        }
      }

      const newDebugInfo = {
        isStandalone,
        isPWA: isStandalone,
        isIOSDevice,
        notificationPermission,
        pushSupported,
        serviceWorkerRegistered,
        hasActiveSubscription,
        subscriptionEndpoint,
        environment,
        isHTTPS,
        userAgent: navigator.userAgent
      };

      setDebugInfo(newDebugInfo);

      addLog(`PWA Status Check Complete`);
      addLog(`Standalone: ${isStandalone}, iOS: ${isIOSDevice}, HTTPS: ${isHTTPS}`);
      addLog(`Permission: ${notificationPermission}, Push: ${pushSupported}`);
      addLog(`SW Registered: ${serviceWorkerRegistered}, Subscription: ${hasActiveSubscription}`);
      
      return newDebugInfo;
    } catch (error) {
      addLog(`PWA status check error: ${error}`);
      return debugInfo;
    }
  };

  const testNotificationFlow = async () => {
    addLog('Starting notification flow test...');
    
    try {
      if (!debugInfo.isStandalone) {
        addLog('❌ PWA not in standalone mode - notifications may not work on iOS');
        return false;
      }

      if (!debugInfo.isHTTPS && debugInfo.environment === 'production') {
        addLog('❌ Not HTTPS in production - notifications will fail');
        return false;
      }

      if (debugInfo.notificationPermission !== 'granted') {
        addLog('🔔 Requesting notification permission...');
        const permission = await Notification.requestPermission();
        addLog(`Permission result: ${permission}`);
        
        if (permission !== 'granted') {
          addLog('❌ Notification permission denied');
          return false;
        }
      }

      if (!debugInfo.serviceWorkerRegistered) {
        addLog('❌ Service worker not registered');
        return false;
      }

      addLog('✅ All checks passed - attempting subscription creation...');
      return true;
    } catch (error) {
      addLog(`Notification flow test error: ${error}`);
      return false;
    }
  };

  const logSubscriptionCreation = (success: boolean, details: any) => {
    if (success) {
      addLog('✅ Push subscription created successfully');
      addLog(`Endpoint: ${details.endpoint?.substring(0, 50)}...`);
    } else {
      addLog('❌ Push subscription creation failed');
      addLog(`Error: ${details.error}`);
    }
  };

  const logSubscriptionPost = (success: boolean, response: any) => {
    if (success) {
      addLog('✅ Subscription POSTed to /api/push/subscribe successfully');
      addLog(`Server response: ${JSON.stringify(response).substring(0, 100)}...`);
    } else {
      addLog('❌ Failed to POST subscription to server');
      addLog(`Error: ${response.error || 'Unknown error'}`);
    }
  };

  useEffect(() => {
    checkPWAStatus();
    
    // Re-check when window gains focus (good for testing)
    const handleFocus = () => {
      addLog('Window focused - rechecking PWA status...');
      checkPWAStatus();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  return {
    debugInfo,
    logs,
    addLog,
    checkPWAStatus,
    testNotificationFlow,
    logSubscriptionCreation,
    logSubscriptionPost,
    clearLogs: () => setLogs([])
  };
}