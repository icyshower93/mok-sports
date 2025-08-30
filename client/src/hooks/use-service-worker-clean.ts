import { useEffect } from "react";

declare const __BUILD_HASH__: string;

export function useServiceWorker() {
  useEffect(() => {
    // Debug flag to skip service worker
    if (new URLSearchParams(location.search).has('nosw')) {
      console.log('[SW] Skipped due to ?nosw parameter');
      return;
    }

    if ('serviceWorker' in navigator) {
      const version = import.meta.env.VITE_BUILD_HASH ?? "dev";
      const swUrl = `/sw.js?v=${version}`;
      
      navigator.serviceWorker.register(swUrl, {
        scope: '/',
        updateViaCache: 'none'
      }).catch(console.error);
      
      console.log('[SW] Registered service worker:', swUrl);
    }
  }, []);
}