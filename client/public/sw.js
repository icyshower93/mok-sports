// Enhanced Mok Sports PWA Service Worker with Auto-Refresh Push Subscriptions
const CACHE_VERSION = 'v1.4.2-seamless-reset-websocket';
const STATIC_CACHE = `mok-sports-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `mok-sports-dynamic-${CACHE_VERSION}`;
const API_CACHE = `mok-sports-api-${CACHE_VERSION}`;

const STATIC_FILES = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/icon-72x72.png'
];

console.log('[SW] Service worker starting, version:', CACHE_VERSION);

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker, version:', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static files');
      return cache.addAll(STATIC_FILES);
    }).then(() => {
      console.log('[SW] Static files cached successfully');
      // Take control immediately to prevent blank screens
      return self.skipWaiting();
    }).catch(err => {
      console.error('[SW] Installation failed:', err);
    })
  );
});

// Activate event - clean old caches and claim clients
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker, version:', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        console.log('[SW] Found caches:', cacheNames);
        const deletePromises = cacheNames
          .filter(cacheName => cacheName.startsWith('mok-sports-') && !cacheName.includes(CACHE_VERSION))
          .map(cacheName => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          });
        
        return Promise.all(deletePromises);
      }),
      // Claim clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('[SW] Service worker activated and controlling all clients');
      // Broadcast activation to trigger subscription refresh
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: CACHE_VERSION,
            timestamp: Date.now()
          });
        });
      });
    }).catch(err => {
      console.error('[SW] Activation failed:', err);
    })
  );
});

// Fetch event - handle network requests with caching strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip caching for some requests
  if (event.request.method !== 'GET' || 
      url.pathname.startsWith('/api/') ||
      url.pathname.includes('hot-update')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        console.log(`[SW] Serving ${url.pathname} from cache`);
        return cachedResponse;
      }

      console.log(`[SW] Fetching ${url.pathname} from network`);
      return fetch(event.request).then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Return offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        throw new Error('Network request failed');
      });
    })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const options = {
    title: 'Mok Sports',
    body: 'You have a new notification!',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    tag: 'default',
    requireInteraction: false,
    silent: false,
    data: {
      url: '/',
      timestamp: Date.now()
    }
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[SW] Push notification payload:', payload);
      
      if (payload.title) options.title = payload.title;
      if (payload.body) options.body = payload.body;
      if (payload.icon) options.icon = payload.icon;
      if (payload.badge) options.badge = payload.badge;
      if (payload.tag) options.tag = payload.tag;
      if (payload.data) options.data = { ...options.data, ...payload.data };
      if (payload.requireInteraction !== undefined) options.requireInteraction = payload.requireInteraction;
      if (payload.silent !== undefined) options.silent = payload.silent;
    } catch (error) {
      console.warn('[SW] Failed to parse push notification payload:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification(options.title, options)
  );
});

// Notification click event - handle user interaction with notifications
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification);
  
  event.notification.close();
  
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Check if there's already a window/tab open with the target URL
      for (let client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          console.log('[SW] Focusing existing window:', client.url);
          return client.focus();
        }
      }
      
      // If no existing window, open a new one
      if (self.clients.openWindow) {
        console.log('[SW] Opening new window:', targetUrl);
        return self.clients.openWindow(targetUrl);
      }
    }).catch(error => {
      console.error('[SW] Failed to handle notification click:', error);
    })
  );
});

// Message event - handle communication with the main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting requested');
    self.skipWaiting();
  }
  
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({
      type: 'VERSION_RESPONSE',
      version: CACHE_VERSION
    });
  }
  
  if (event.data?.type === 'FORCE_CACHE_REFRESH') {
    console.log('[SW] Force cache refresh requested for:', event.data.reason);
    
    // Clear all caches for fresh data
    caches.keys().then((cacheNames) => {
      const deletePromises = cacheNames
        .filter(cacheName => cacheName.startsWith('mok-sports-'))
        .map(cacheName => {
          console.log('[SW] Clearing cache for refresh:', cacheName);
          return caches.delete(cacheName);
        });
      
      return Promise.all(deletePromises);
    }).then(() => {
      console.log('[SW] All caches cleared for refresh');
      
      // Notify clients that caches are cleared
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'CACHE_CLEARED',
            reason: event.data.reason,
            timestamp: Date.now()
          });
        });
      });
    }).catch(err => {
      console.error('[SW] Failed to clear caches:', err);
    });
  }
});

console.log('[SW] Service worker script loaded successfully');