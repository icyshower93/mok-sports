/**
 * Service Worker Cleanup Utilities
 * 
 * Addresses platform-level service worker interference with WebSocket connections
 * and ensures complete cache clearing for draft resets.
 */

export class ServiceWorkerManager {
  // FIX #3: Complete Service Worker unregistration
  static async unregisterAllServiceWorkers(): Promise<void> {
    console.log('[ServiceWorker] 🔄 CLEANUP: Starting complete service worker unregistration');
    
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log('[ServiceWorker] 🔍 FOUND:', registrations.length, 'service worker registrations');
        
        const unregisterPromises = registrations.map(async (registration) => {
          console.log('[ServiceWorker] 🗑️ UNREGISTERING:', registration.scope);
          const success = await registration.unregister();
          console.log('[ServiceWorker]', success ? '✅ SUCCESS' : '❌ FAILED', 'unregistering:', registration.scope);
          return success;
        });
        
        const results = await Promise.all(unregisterPromises);
        const successCount = results.filter(Boolean).length;
        console.log('[ServiceWorker] 🎯 COMPLETED: Unregistered', successCount, 'of', registrations.length, 'service workers');
        
        // Force reload to ensure clean state
        if (registrations.length > 0) {
          console.log('[ServiceWorker] 🔄 FORCING PAGE RELOAD for clean state');
          window.location.reload();
        }
      } catch (error) {
        console.error('[ServiceWorker] ❌ ERROR during unregistration:', error);
      }
    } else {
      console.log('[ServiceWorker] ❌ Service Worker not supported in this browser');
    }
  }

  // FIX #3: Clear all caches that might interfere with WebSocket or API calls
  static async clearAllCaches(): Promise<void> {
    console.log('[ServiceWorker] 🔄 CACHE CLEANUP: Starting comprehensive cache clearing');
    
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        console.log('[ServiceWorker] 🔍 FOUND CACHES:', cacheNames);
        
        const deletePromises = cacheNames.map(async (cacheName) => {
          console.log('[ServiceWorker] 🗑️ DELETING CACHE:', cacheName);
          const success = await caches.delete(cacheName);
          console.log('[ServiceWorker]', success ? '✅ DELETED' : '❌ FAILED', 'cache:', cacheName);
          return success;
        });
        
        const results = await Promise.all(deletePromises);
        const successCount = results.filter(Boolean).length;
        console.log('[ServiceWorker] 🎯 CACHE CLEANUP COMPLETE:', successCount, 'of', cacheNames.length, 'caches deleted');
      } catch (error) {
        console.error('[ServiceWorker] ❌ ERROR during cache cleanup:', error);
      }
    } else {
      console.log('[ServiceWorker] ❌ Cache API not supported in this browser');
    }
  }

  // FIX #3: Complete storage cleanup (localStorage/sessionStorage)
  static clearAllStorage(): void {
    console.log('[ServiceWorker] 🔄 STORAGE CLEANUP: Starting localStorage/sessionStorage cleanup');
    
    try {
      // Clear localStorage
      const localStorageKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) localStorageKeys.push(key);
      }
      
      localStorageKeys.forEach(key => {
        if (key.includes('draft') || key.includes('websocket') || key.includes('cache') || key.includes('timer')) {
          console.log('[ServiceWorker] 🗑️ CLEARING localStorage key:', key);
          localStorage.removeItem(key);
        }
      });
      
      // Clear sessionStorage
      const sessionStorageKeys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) sessionStorageKeys.push(key);
      }
      
      sessionStorageKeys.forEach(key => {
        if (key.includes('draft') || key.includes('websocket') || key.includes('cache') || key.includes('timer')) {
          console.log('[ServiceWorker] 🗑️ CLEARING sessionStorage key:', key);
          sessionStorage.removeItem(key);
        }
      });
      
      console.log('[ServiceWorker] ✅ STORAGE CLEANUP COMPLETE');
    } catch (error) {
      console.error('[ServiceWorker] ❌ ERROR during storage cleanup:', error);
    }
  }

  // Complete cleanup for draft resets
  static async performCompleteCleanup(): Promise<void> {
    console.log('[ServiceWorker] 🚀 STARTING COMPLETE PLATFORM CLEANUP');
    
    // Run all cleanup operations
    await Promise.all([
      this.clearAllCaches(),
      new Promise(resolve => {
        this.clearAllStorage();
        resolve(void 0);
      })
    ]);
    
    // Unregister service workers last (may cause page reload)
    await this.unregisterAllServiceWorkers();
    
    console.log('[ServiceWorker] 🎯 COMPLETE CLEANUP FINISHED');
  }
}