// Cache management utilities to prevent MIME type errors

export class CacheManager {
  static async clearAllCaches(): Promise<void> {
    if (!('caches' in window)) {
      console.log('[Cache] Cache API not supported');
      return;
    }

    try {
      const cacheNames = await caches.keys();
      console.log('[Cache] Found caches to clear:', cacheNames);
      
      await Promise.all(
        cacheNames.map(cacheName => {
          console.log('[Cache] Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
      
      console.log('[Cache] All caches cleared successfully');
    } catch (error) {
      console.error('[Cache] Error clearing caches:', error);
    }
  }

  static async clearServiceWorkerCaches(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.log('[SW] Service workers not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && registration.active) {
        // Ask service worker to clear its caches
        registration.active.postMessage({ type: 'CLEAR_CACHES' });
        console.log('[SW] Requested service worker to clear caches');
      }
    } catch (error) {
      console.error('[SW] Error communicating with service worker:', error);
    }
  }

  static async unregisterServiceWorkers(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(registration => {
          console.log('[SW] Unregistering service worker');
          return registration.unregister();
        })
      );
      console.log('[SW] All service workers unregistered');
    } catch (error) {
      console.error('[SW] Error unregistering service workers:', error);
    }
  }

  static async fullCacheReset(): Promise<void> {
    console.log('[Cache] Starting full cache reset...');
    
    await Promise.all([
      this.clearAllCaches(),
      this.clearServiceWorkerCaches(),
      this.unregisterServiceWorkers()
    ]);

    // Clear localStorage and sessionStorage
    try {
      localStorage.clear();
      sessionStorage.clear();
      console.log('[Cache] Storage cleared');
    } catch (error) {
      console.error('[Cache] Error clearing storage:', error);
    }

    console.log('[Cache] Full cache reset complete');
  }

  static detectModuleLoadError(error: Error | string): boolean {
    const errorMessage = typeof error === 'string' ? error : error.message;
    
    return errorMessage.includes('MIME type') ||
           errorMessage.includes('module script') ||
           errorMessage.includes('Failed to fetch') ||
           errorMessage.includes('Loading CSS chunk') ||
           errorMessage.includes('Loading chunk');
  }

  static async handleModuleLoadError(): Promise<void> {
    console.error('[Cache] Module load error detected - performing full cache reset');
    
    await this.fullCacheReset();
    
    // Reload the page after a brief delay
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }
}

// Listen for service worker messages
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('[SW] Received message:', event.data);
    
    if (event.data.type === 'CACHE_UPDATED') {
      console.log('[SW] Cache updated, reloading page...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  });
}

// Global error handler for module loading errors
window.addEventListener('error', (event) => {
  if (CacheManager.detectModuleLoadError(event.error || event.message)) {
    console.error('[Global] Module loading error detected:', event.error);
    CacheManager.handleModuleLoadError();
  }
});

// Handle unhandled promise rejections that might be module loading errors
window.addEventListener('unhandledrejection', (event) => {
  if (CacheManager.detectModuleLoadError(event.reason)) {
    console.error('[Global] Module loading promise rejection detected:', event.reason);
    CacheManager.handleModuleLoadError();
  }
});