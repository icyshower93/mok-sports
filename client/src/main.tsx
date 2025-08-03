import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register service worker for PWA functionality and push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[PWA] Service worker registered successfully:', registration);
      
      // Listen for service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New service worker available');
              // Could show update available notification here
            }
          });
        }
      });
    } catch (error) {
      console.error('[PWA] Service worker registration failed:', error);
    }
  });

  // Listen for messages from service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    const { type, url } = event.data;
    
    if (type === 'NOTIFICATION_CLICK' && url) {
      // Handle navigation from notification click
      window.location.href = url;
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
