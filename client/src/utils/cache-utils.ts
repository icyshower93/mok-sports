/**
 * Cache clearing utilities for development and troubleshooting
 */

export async function clearAllCaches(): Promise<void> {
  try {
    // Clear service worker registrations
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
      console.log('[Cache] Service workers unregistered');
    }

    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('[Cache] All caches cleared:', cacheNames);
    }

    // Clear localStorage
    localStorage.clear();
    console.log('[Cache] localStorage cleared');
    
    // Clear sessionStorage
    sessionStorage.clear();
    console.log('[Cache] sessionStorage cleared');

  } catch (error) {
    console.error('[Cache] Error clearing caches:', error);
  }
}

export async function clearCachesAndReload(): Promise<void> {
  await clearAllCaches();
  setTimeout(() => window.location.reload(), 500);
}

// Dev-only cache clearing button for console
if (import.meta.env.DEV) {
  (window as any).clearCaches = clearCachesAndReload;
  console.log('%c[DEV] Cache clearing utility available: clearCaches()', 'color: orange; font-weight: bold');
}