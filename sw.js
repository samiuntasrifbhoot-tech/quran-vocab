const CACHE = 'quran-v3';
const FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/data/vocabulary.json',
  '/data/quran.json',
  '/data/quran-context-verses.json',
  '/data/grammar.json',
  '/data/curriculum.json'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).catch(err => console.warn(err)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) {
    return; // Don't cache dynamic API requests
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
