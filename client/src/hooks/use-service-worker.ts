import { useState, useEffect, useCallback } from 'react';

export interface ServiceWorkerStatus {
  isRegistered: boolean;
  isActive: boolean;
  isWaiting: boolean;
  version: string;
  updateAvailable: boolean;
  registration?: ServiceWorkerRegistration;
}

  const [status, setStatus] = useState<ServiceWorkerStatus>({
    isRegistered: false,
    isActive: false,
    isWaiting: false,
    version: '',
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
      // Add cache-busting timestamp
      const swUrl = `/sw.js?v=${Date.now()}`;

      const registration = await navigator.serviceWorker.register(swUrl, {
        scope: '/',
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
        registration.active.addEventListener('statechange', () => {
          updateServiceWorkerStatus(registration);
        });
      }

      updateServiceWorkerStatus(registration);
      return registration;

    } catch (error) {
      return null;
    }
  }, [updateServiceWorkerStatus]);

  const skipWaiting = useCallback(async () => {
    if (status.registration?.waiting) {
      status.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [status.registration]);

  // Auto-register service worker when conditions are met
  useEffect(() => {
    if (!isPageLoaded) return;

    const shouldRegister = enableInPWAOnly ? 
      window.matchMedia('(display-mode: standalone)').matches : true;

    if (shouldRegister) {
      registerServiceWorker();
    } else {
    }
  }, [isPageLoaded, enableInPWAOnly, registerServiceWorker]);

  return {
    status,
    registerServiceWorker,
    skipWaiting,
    isPageLoaded
  };
}