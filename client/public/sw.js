// Mok Sports PWA Service Worker - Refactored for Reliability
// Version: 2.0.0 - Enhanced with skipWaiting and proper lifecycle management

const CACHE_VERSION = `v${Date.now()}`;
const CACHE_NAME = `mok-sports-${CACHE_VERSION}`;
const STATIC_CACHE = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE = `${CACHE_NAME}-dynamic`;
const API_CACHE = `${CACHE_NAME}-api`;

console.log('[SW] Service worker loading, version:', CACHE_VERSION);

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

// Install event - cache essential files and skip waiting
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker, version:', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Cache static files
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_FILES).catch(err => {
          console.warn('[SW] Failed to cache some static files:', err);
        });
      }),
      // Pre-cache API endpoints
      caches.open(API_CACHE).then((cache) => {
        console.log('[SW] Pre-caching API endpoints');
        return Promise.allSettled(
          API_ENDPOINTS.map(url => cache.add(url))
        );
      })
    ]).then(() => {
      console.log('[SW] Installation complete, taking control');
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
      // Clean up ALL old caches to prevent MIME type issues
      caches.keys().then((cacheNames) => {
        console.log('[SW] Found caches:', cacheNames);
        const deletePromises = cacheNames
          .filter(cacheName => cacheName.startsWith('mok-sports-') && !cacheName.includes(CACHE_VERSION))
          .map(cacheName => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          });
        
        // Also clear any caches that might contain stale JS/CSS
        const additionalCleanup = cacheNames
          .filter(cacheName => cacheName.includes('workbox') || cacheName.includes('runtime'))
          .map(cacheName => {
            console.log('[SW] Deleting potentially problematic cache:', cacheName);
            return caches.delete(cacheName);
          });
          
        return Promise.all([...deletePromises, ...additionalCleanup]);
      }),
      // Take control of all clients immediately and reload them
      self.clients.claim().then(() => {
        return self.clients.matchAll();
      }).then((clients) => {
        // Notify all clients to reload to get fresh resources
        clients.forEach(client => {
          client.postMessage({ type: 'CACHE_UPDATED', version: CACHE_VERSION });
        });
      })
    ]).then(() => {
      console.log('[SW] Activation complete, controlling all clients');
    }).catch(err => {
      console.error('[SW] Activation failed:', err);
    })
  );
});

// Message handler for skipWaiting requests and cache management
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting requested');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHES') {
    console.log('[SW] Cache clear requested');
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map(cacheName => {
            console.log('[SW] Clearing cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        console.log('[SW] All caches cleared');
        // Notify client that caches are cleared
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'CACHES_CLEARED' });
          });
        });
      })
    );
  }
});

// Fetch event - improved caching strategy to prevent MIME type errors
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests, chrome-extension URLs, and different origins
  if (request.method !== 'GET' || 
      url.protocol === 'chrome-extension:' || 
      url.origin !== self.location.origin) {
    return;
  }

  // Critical: Always use network-first for JS/CSS modules to prevent MIME errors
  if (url.pathname.match(/\.(js|mjs|jsx|ts|tsx|css)$/)) {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  // Handle different request types
  if (url.pathname.startsWith('/api/auth/')) {
    // Authentication endpoints - ALWAYS go to network, never cache
    console.log('[SW] Auth endpoint - bypassing cache:', url.pathname);
    event.respondWith(fetch(request));
  } else if (url.pathname.startsWith('/api/')) {
    // Other API requests - network first with cache fallback
    event.respondWith(networkFirstStrategy(request, API_CACHE));
  } else if (STATIC_FILES.includes(url.pathname) || url.pathname === '/') {
    // Static files and app shell - network first to ensure fresh content
    event.respondWith(networkFirstStrategy(request, STATIC_CACHE));
  } else if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|ttf|eot)$/)) {
    // Non-critical assets - cache first
    event.respondWith(cacheFirstStrategy(request, DYNAMIC_CACHE));
  } else {
    // Everything else - network first
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
  }
});

// Special strategy for critical JS/CSS files to prevent MIME errors
async function networkFirstWithFallback(request) {
  try {
    console.log('[SW] Fetching critical resource:', request.url);
    const networkResponse = await fetch(request);
    
    // Only cache if we get the correct content type
    if (networkResponse.ok && networkResponse.headers.get('content-type')?.includes('javascript') || 
        networkResponse.headers.get('content-type')?.includes('css')) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      console.log('[SW] Cached critical resource:', request.url);
    } else if (!networkResponse.ok) {
      console.error('[SW] Failed to fetch critical resource:', request.url, networkResponse.status);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Network error for critical resource:', request.url, error);
    
    // Try cache as absolute last resort
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Using cached version of critical resource:', request.url);
      return cachedResponse;
    }
    
    // Don't fallback to offline page for JS/CSS - let it fail properly
    throw error;
  }
}

// Caching strategies
async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
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
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return createOfflineResponse();
    }
    
    throw error;
  }
}

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
    if (request.mode === 'navigate') {
      return createOfflineResponse();
    }
    throw error;
  }
}

async function staleWhileRevalidateStrategy(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then(async (networkResponse) => {
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    console.log('[SW] Network failed for:', request.url);
  });
  
  return cachedResponse || fetchPromise;
}

function createOfflineResponse() {
  return new Response(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Mok Sports - Offline</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            font-family: system-ui, sans-serif; 
            text-align: center; 
            padding: 2rem;
            background: linear-gradient(135deg, #10b981, #3b82f6);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
          }
          .container {
            background: rgba(255,255,255,0.1);
            padding: 2rem;
            border-radius: 1rem;
            backdrop-filter: blur(10px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🏈 Mok Sports</h1>
          <p>You're currently offline</p>
          <p>Please check your internet connection and try again.</p>
          <button onclick="window.location.reload()">Retry</button>
        </div>
      </body>
    </html>
  `, {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
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
      console.log('[SW] Parsed notification data:', notificationData);
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
    requireInteraction: false,
    silent: false,
    vibrate: notificationData.data?.type === 'welcome' ? [200, 100, 200] : [100],
    tag: notificationData.data?.type || 'general',
    renotify: true,
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

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Check if app is already open
        for (const client of clients) {
          if (client.url.includes(self.registration.scope)) {
            client.focus();
            client.navigate(urlToOpen);
            return;
          }
        }
        
        // Open new window if app not already open
        return self.clients.openWindow(urlToOpen);
      })
  );
});

console.log('[SW] Service worker script loaded successfully');