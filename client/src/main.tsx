import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Enhanced iOS swipe prevention
if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
  // Prevent edge swipe navigation on iOS
  let startX = 0;
  let startY = 0;
  
  document.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: false });
  
  document.addEventListener('touchmove', (e) => {
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX;
    const diffY = currentY - startY;
    
    // Prevent horizontal swipes from edge
    if (Math.abs(diffX) > Math.abs(diffY) && (startX < 20 || startX > window.innerWidth - 20)) {
      e.preventDefault();
    }
  }, { passive: false });
}

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
