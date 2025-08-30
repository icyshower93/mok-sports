import { useState, useEffect, useCallback } from 'react';

export interface ServiceWorkerStatus {
  isRegistered: boolean;
  isActive: boolean;
  isWaiting: boolean;
  version: string;
  updateAvailable: boolean;
  registration?: ServiceWorkerRegistration;
}

export function useServiceWorker(enableInPWAOnly: boolean = true) {
  const [status, setStatus] = useState<ServiceWorkerStatus>({
    isRegistered: false,
    isActive: false,
    isWaiting: false,
    version: '',
    updateAvailable: false
  });

  const [isPageLoaded, setIsPageLoaded] = useState(false);

  // Check if page is fully loaded
  useEffect(() => {
    if (document.readyState === 'complete') {
      setIsPageLoaded(true);
    } else {
      const handleLoad = () => setIsPageLoaded(true);
      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    }
  }, []);

  const updateServiceWorkerStatus = useCallback((registration: ServiceWorkerRegistration) => {
    if (!registration) {
      setStatus(prev => ({ ...prev, isRegistered: false, isActive: false }));
      return;
    }

    const sw = registration.active || registration.installing || registration.waiting;
    const version = sw?.scriptURL.split('?v=')[1] || Date.now().toString();

    setStatus({
      isRegistered: true,
      isActive: !!registration.active,
      isWaiting: !!registration.waiting,
      version,
      updateAvailable: !!registration.waiting,
      registration
    });
  }, []);

  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      return null;
    }

    try {
      // DEV-only, first render only - no runtime unregistration
      if (import.meta.env.DEV) {
        console.log('[SW Hook] DEV: Service worker registration in development mode');
        // Only clear on explicit request, not during normal runtime
      }
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Use build hash for service worker versioning
      const { BUILD_INFO } = await import('../lib/buildInfo');
      const swUrl = `/sw.js?v=${BUILD_INFO.hash}`;
      console.log('[SW Hook] Registering service worker with build hash:', swUrl);

      const registration = await navigator.serviceWorker.register(swUrl, {
        scope: '/',
        updateViaCache: 'none' // Force no caching of service worker
      });

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              updateServiceWorkerStatus(registration);
            }
          });
        }
      });

      // Handle active service worker
      if (registration.active) {
        updateServiceWorkerStatus(registration);
      }

      // Handle waiting service worker
      if (registration.waiting) {
        updateServiceWorkerStatus(registration);
      }

      console.log('[SW Hook] Service worker registered successfully');
      return registration;
    } catch (error) {
      console.error('[SW Hook] Service worker registration failed:', error);
      return null;
    }
  }, [updateServiceWorkerStatus]);

  // Register service worker when page loads
  useEffect(() => {
    if (!isPageLoaded) return;

    // Check if running in PWA mode and respect the enableInPWAOnly flag
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  (window.navigator as any).standalone === true ||
                  document.referrer.includes('android-app://');

    if (enableInPWAOnly && !isPWA) {
      console.log('[SW Hook] Service worker disabled - not in PWA mode');
      return;
    }

    registerServiceWorker();
  }, [isPageLoaded, enableInPWAOnly, registerServiceWorker]);

  const activateWaitingServiceWorker = useCallback(async () => {
    if (status.registration?.waiting) {
      status.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }, [status.registration]);

  const clearCaches = useCallback(async () => {
    if (status.registration) {
      status.registration.active?.postMessage({ type: 'CLEAR_CACHES' });
    }
  }, [status.registration]);

  return {
    ...status,
    registerServiceWorker,
    activateWaitingServiceWorker,
    clearCaches
  };
}