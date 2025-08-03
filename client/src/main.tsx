import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

console.log('[iOS Debug] main.tsx loading...');

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

try {
  const rootElement = document.getElementById("root");
  console.log('[iOS Debug] Root element found:', !!rootElement);
  
  if (!rootElement) {
    throw new Error('Root element not found');
  }
  
  console.log('[iOS Debug] Creating React root...');
  const root = createRoot(rootElement);
  
  console.log('[iOS Debug] Rendering App...');
  root.render(<App />);
  
  console.log('[iOS Debug] App rendered successfully');
} catch (error) {
  console.error('[iOS Debug] Error during app initialization:', error);
  
  // Emergency fallback render
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="min-height:100vh;background:#ef4444;display:flex;align-items:center;justify-content:center;color:white;font-family:sans-serif;text-align:center;padding:20px">
        <div>
          <h1>App Error</h1>
          <p>Failed to load on iOS Safari</p>
          <p style="font-size:12px;margin-top:10px;font-family:monospace">${error.message}</p>
          <button onclick="window.location.reload()" style="background:white;color:#ef4444;border:none;padding:10px 20px;border-radius:5px;margin-top:10px">
            Reload
          </button>
        </div>
      </div>
    `;
  }
}
