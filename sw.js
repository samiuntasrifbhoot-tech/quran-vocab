const CACHE_VERSION = 'quran-v14';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './css/app.css',
  './js/app.js',
  './js/srs.js',
  './js/storage.js'
];

const DATA_ASSETS = [
  './data/vocabulary.json',
  './data/quran-context-verses.json',
  './data/curriculum.json',
  './data/grammar.json',
  './data/vocabulary-validation.json'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_VERSION).then(async cache => {
      // 1. Pre-cache app shell assets
      try {
        await cache.addAll(STATIC_ASSETS);
      } catch (err) {
        console.warn('[SW] Pre-cache static assets warning:', err);
      }
      // 2. Pre-cache data assets individually so one failure does not break installation
      for (const asset of DATA_ASSETS) {
        try {
          const res = await fetch(asset);
          if (res && res.ok) {
            await cache.put(asset, res);
          }
        } catch (err) {
          console.warn('[SW] Pre-cache data asset warning for ' + asset, err);
        }
      }
    })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(async keys => {
      const oldKeys = keys.filter(k => k !== CACHE_VERSION);
      const newCache = await caches.open(CACHE_VERSION);

      // Preserve existing cached data files from old caches into the new cache
      for (const oldKey of oldKeys) {
        try {
          const oldCache = await caches.open(oldKey);
          const oldRequests = await oldCache.keys();
          for (const req of oldRequests) {
            if (req.url.includes('/data/') || req.url.endsWith('.json')) {
              const oldMatch = await oldCache.match(req);
              if (oldMatch) {
                const newMatch = await newCache.match(req);
                if (!newMatch) {
                  await newCache.put(req, oldMatch);
                }
              }
            }
          }
        } catch (err) {
          console.warn('[SW] Cache migration warning:', err);
        }
        await caches.delete(oldKey);
      }
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip dynamic backend API proxy requests
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Cache-First with Background Revalidation for static datasets
  // Ensures offline & weak networks get instant data without timeout!
  if (url.pathname.includes('/data/') || url.pathname.endsWith('.json')) {
    e.respondWith(
      caches.match(e.request).then(async cachedResponse => {
        // Background refresh to keep data up to date when online
        const backgroundFetch = fetch(e.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.ok) {
              const ct = networkResponse.headers.get('content-type') || '';
              if (ct.includes('application/json') || ct.includes('text/plain') || !ct.includes('text/html')) {
                const clone = networkResponse.clone();
                caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
              }
            }
            return networkResponse;
          })
          .catch(() => null);

        // 1. If in cache, return immediately (instant 0ms loading!)
        if (cachedResponse) {
          return cachedResponse;
        }

        // 2. If not matched with exact URL, check if any cached entry matches the filename
        const fileName = url.pathname.split('/').pop();
        if (fileName) {
          const cache = await caches.open(CACHE_VERSION);
          const keys = await cache.keys();
          for (const req of keys) {
            if (req.url.endsWith(fileName)) {
              const match = await cache.match(req);
              if (match) return match;
            }
          }
        }

        // 3. Fallback to backgroundFetch or network
        const netRes = await backgroundFetch;
        if (netRes) return netRes;

        // 4. Fallback search again across all caches
        const match = await caches.match(e.request);
        if (match) return match;

        // 5. Ultimate fallback: return empty JSON rather than undefined
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Cache-First with Network fallback for static shell assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
