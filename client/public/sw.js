// Guard "nuclear" actions to development only
const DEV =
  self.location.hostname.includes('localhost') ||
  self.location.host.includes('replit');

const CACHE_VERSION = 'static-' + (DEV ? 'dev-' + Date.now() : 'prod-v1.0.0');

self.addEventListener('install', (event) => {
  // In DEV it's fine to activate immediately
  if (DEV && self.skipWaiting) self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Only wipe caches aggressively in DEV
    if (DEV) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
    await self.clients.claim();
  })());
});

// Strategy:
// - API: network-first (don't cache mutable API by default)
// - Static hashed assets: cache-first
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Network-first for API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req));
    return;
  }

  // Cache-first for common static assets
  if (url.origin === self.location.origin && /\.(?:js|css|png|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      try {
        const cache = await caches.open(CACHE_VERSION);
        cache.put(req, res.clone());
      } catch {}
      return res;
    })());
  }
});