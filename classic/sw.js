// Network-first: always try the fresh file, fall back to the cached copy only when offline.
const C = 'mx-v2';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(C).then(c => c.put(e.request, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.open(C).then(c => c.match(e.request)).then(r => r || Response.error()))
  );
});
