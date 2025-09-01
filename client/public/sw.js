// Guard "nuclear" actions to development only
const DEV =
  self.location.hostname.includes('localhost') ||
  self.location.host.includes('replit');

const BUILD_HASH = (() => {
  try { 
    return self.location.search.match(/[?&]v=([^&]+)/)?.[1] || Date.now().toString(36);
  } catch { 
    return Date.now().toString(36); 
  }
})();
const CACHE_VERSION = 'static-' + (DEV ? 'dev-' + BUILD_HASH : 'prod-' + BUILD_HASH);

self.addEventListener('install', (event) => {
  // Always activate immediately
  if (self.skipWaiting) self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Clear old cache versions (keeps current version)
    const names = await caches.keys();
    const currentPrefix = CACHE_VERSION.split('-').slice(0, 2).join('-'); // Keep 'static-dev' or 'static-prod' 
    const oldCaches = names.filter(name => 
      name.startsWith('static-') && !name.startsWith(currentPrefix)
    );
    
    if (DEV || oldCaches.length > 0) {
      console.log('[SW] Clearing', DEV ? 'all caches (dev)' : 'old caches:', DEV ? names : oldCaches);
      await Promise.all((DEV ? names : oldCaches).map((n) => caches.delete(n)));
    }
    
    if (self.clients && self.clients.claim) await self.clients.claim();
  })());
});

// Strategy:
// - API: network-first (don't cache mutable API by default)
// - Static hashed assets: cache-first
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Always network-first for HTML/shell
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith((async () => {
      try { return await fetch(req, { cache: 'no-store' }); }
      catch { return await caches.match('/index.html'); }
    })());
    return;
  }

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