// Debug imports removed
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
      // One-time safety: clear known old caches (remove after a few releases)
      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          for (const key of keys) {
            if (key.includes("workbox") || key.includes("vite") || key.includes("mok")) {
              await caches.delete(key);
              console.log('[SW Hook] Cleared stale cache:', key);
            }
          }
        }
      } catch {}

      // Use build hash for service worker versioning
      const version = (() => { try { return import.meta.env.VITE_BUILD_HASH; } catch { return "dev"; } })() ?? "dev";
      const swUrl = `/sw.js?v=${version}`;
      console.log('[SW Hook] Registering service worker with build hash:', swUrl);

      const registration = await navigator.serviceWorker.register(swUrl, {
        scope: '/',
        updateViaCache: 'none' // Force no caching of service worker
      });

      // Update flow: prompt + reload when a new SW is waiting
      registration.addEventListener('updatefound', () => {
        const sw = registration.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            // a new version is available; trigger update
            registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
            setTimeout(() => window.location.reload(), 100);
            updateServiceWorkerStatus(registration);
          }
        });
      });

      // Handle controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // controller changed → page will be controlled by the new SW
        console.log('[SW Hook] Service worker controller changed');
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

    // Allow service worker in development when debug UI is enabled for push notification testing
    const debugUIEnabled = (import.meta as any).env?.VITE_ENABLE_DEBUG_UI === "true" ||
                           (typeof process !== "undefined" && (process as any).env?.VITE_ENABLE_DEBUG_UI === "true");

    if (enableInPWAOnly && !isPWA && !debugUIEnabled) {
      console.log('[SW Hook] Service worker disabled - not in PWA mode and debug UI not enabled');
      return;
    }

    if (debugUIEnabled && !isPWA) {
      console.log('[SW Hook] Service worker enabled for debug UI - push notification testing');
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