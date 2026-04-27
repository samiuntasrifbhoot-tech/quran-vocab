const CACHE='quran-v1';
const FILES=['/quran-vocab/','/quran-vocab/index.html','/quran-vocab/manifest.json','/quran-vocab/icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)))});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
