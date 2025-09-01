import { trace } from "@/debug/trace";
trace("cache-manager.ts");
// Cache management utilities to prevent MIME type errors

export class CacheManager {
  private static instance: CacheManager;
  private cacheSize = 0;
  private maxSize = 5 * 1024 * 1024; // 5MB limit

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  async clearAllCaches(): Promise<void> {
    if (!('caches' in window)) {
      return;
    }

    try {
      const cacheNames = await caches.keys();
      
      await Promise.all(
        cacheNames.map(cacheName => {
          return caches.delete(cacheName);
        })
      );
      
      this.cacheSize = 0;
    } catch (error) {
      console.error('Failed to clear caches:', error);
    }
  }

  async clearServiceWorkerCaches(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && registration.active) {
        // Ask service worker to clear its caches
        registration.active.postMessage({ type: 'CLEAR_CACHES' });
      }
    } catch (error) {
      console.error('Failed to clear service worker caches:', error);
    }
  }

  async refreshServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
      }
    } catch (error) {
      console.error('Failed to refresh service worker:', error);
    }
  }

  async getCacheSize(): Promise<number> {
    if (!('caches' in window)) {
      return 0;
    }

    try {
      const cacheNames = await caches.keys();
      let totalSize = 0;

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        
        for (const request of keys) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }
      }

      this.cacheSize = totalSize;
      return totalSize;
    } catch (error) {
      console.error('Failed to calculate cache size:', error);
      return 0;
    }
  }

  isOverLimit(): boolean {
    return this.cacheSize > this.maxSize;
  }

  async cleanupIfNeeded(): Promise<void> {
    const currentSize = await this.getCacheSize();
    
    if (currentSize > this.maxSize) {
      await this.clearAllCaches();
    }
  }
}

// ✅ Lazy accessor pattern to prevent TDZ errors
let _cacheManager: CacheManager | null = null;
export function getCacheManager(): CacheManager {
  return (_cacheManager ??= CacheManager.getInstance());
}