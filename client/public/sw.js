// Mok Sports PWA Service Worker
// Version: 1.1.0
// Last updated: 2025-01-03

const CACHE_NAME = 'mok-sports-v1.1.0';
const STATIC_CACHE_NAME = `${CACHE_NAME}-static`;
const API_CACHE_NAME = `${CACHE_NAME}-api`;

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/icon-72x72.png',
  '/favicon.ico',
  '/manifest.json'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/auth/config',
  '/api/nfl-teams'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  
  event.waitUntil(
    Promise.all([
      // Cache static files
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_FILES);
      }),
      // Cache API endpoints
      caches.open(API_CACHE_NAME).then((cache) => {
        console.log('[SW] Pre-caching API endpoints');
        return cache.addAll(API_ENDPOINTS);
      })
    ]).then(() => {
      console.log('[SW] Installation complete');
      // Take control immediately
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            // Delete old caches that don't match current version
            return cacheName.startsWith('mok-sports-') && 
                   !cacheName.startsWith(CACHE_NAME);
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    // API requests - network first, cache fallback
    event.respondWith(networkFirstStrategy(request, API_CACHE_NAME));
  } else if (STATIC_FILES.some(file => url.pathname === file)) {
    // Static files - cache first, network fallback
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE_NAME));
  } else if (url.pathname === '/' || !url.pathname.includes('.')) {
    // SPA routes - try cache, fallback to index.html, then network
    event.respondWith(navigateFallbackStrategy(request));
  } else {
    // Other assets - stale while revalidate
    event.respondWith(staleWhileRevalidateStrategy(request, STATIC_CACHE_NAME));
  }
});

// Network first strategy (good for API calls)
async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for failed requests
    return new Response(
      JSON.stringify({ 
        error: 'Offline', 
        message: 'This request requires an internet connection' 
      }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Cache first strategy (good for static assets)
async function cacheFirstStrategy(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Failed to fetch:', request.url);
    return new Response('Offline', { status: 503 });
  }
}

// Navigate fallback strategy (good for SPA routing)
async function navigateFallbackStrategy(request) {
  try {
    return await fetch(request);
  } catch (error) {
    // Try to serve the cached index.html for navigation requests
    const cachedResponse = await caches.match('/');
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('Offline', { 
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Stale while revalidate strategy
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then(async (networkResponse) => {
    if (networkResponse.ok) {
      try {
        const cache = await caches.open(cacheName);
        await cache.put(request, networkResponse.clone());
      } catch (error) {
        console.log('[SW] Cache put failed:', error);
      }
    }
    return networkResponse;
  }).catch(() => {
    console.log('[SW] Network failed for:', request.url);
  });
  
  return cachedResponse || fetchPromise;
}

// Push notification event handler
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);
  
  let notificationData = {
    title: 'Mok Sports',
    body: 'New notification',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    data: {
      url: '/',
      timestamp: Date.now()
    }
  };

  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = { ...notificationData, ...pushData };
    } catch (error) {
      console.error('[SW] Error parsing push data:', error);
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  const notificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    data: notificationData.data,
    tag: notificationData.data?.type || 'general',
    renotify: true,
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open App',
        icon: '/icon-72x72.png'
      },
      {
        action: 'close',
        title: 'Dismiss',
        icon: '/icon-72x72.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationOptions)
      .then(() => {
        console.log('[SW] Notification displayed successfully');
      })
      .catch((error) => {
        console.error('[SW] Error showing notification:', error);
      })
  );
});

// Notification click event handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Default action or 'open' action
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            if (urlToOpen !== '/') {
              // Navigate to specific URL
              client.postMessage({
                type: 'NOTIFICATION_CLICK',
                url: urlToOpen
              });
            }
            return client.focus();
          }
        }
        
        // Open new window
        return clients.openWindow(urlToOpen);
      })
      .catch((error) => {
        console.error('[SW] Error handling notification click:', error);
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'league-action') {
    event.waitUntil(syncLeagueActions());
  }
});

// Sync pending league actions when back online
async function syncLeagueActions() {
  try {
    // Check if there are any pending actions stored in IndexedDB
    // This would sync things like join league, leave league, etc.
    console.log('[SW] Syncing league actions');
    
    // Implementation would depend on how you store offline actions
    // For now, just log that sync is working
    
  } catch (error) {
    console.error('[SW] Error syncing league actions:', error);
  }
}

// Handle messages from the main app
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_NAME });
      break;
      
    case 'CACHE_URLS':
      if (payload && payload.urls) {
        caches.open(STATIC_CACHE_NAME).then(cache => {
          cache.addAll(payload.urls);
        });
      }
      break;
      
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

console.log('[SW] Service worker script loaded successfully');