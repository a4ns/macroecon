/* «Макро» service worker — fresh-first, works offline after a visit.
   Scope: / (the classic build lives in /classic/ with its own worker). */
const V = 'macro-m1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'app/css/tokens.css', 'app/css/base.css', 'app/css/ui.css', 'app/css/views.css', 'app/js/main.js'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(V).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))));
});
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('macro-') && k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));

const isFresh = (req, url) => req.mode === 'navigate' || /\.(?:js|css|html|json|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/classic/') || url.pathname === '/classic') return;
  if (isFresh(req, url)) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(V).then((c) => c.put(req, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.open(V).then((c) => c.match(req, { ignoreSearch: true })).then((r) => r || caches.match('index.html') || Response.error())));
  } else {
    e.respondWith(caches.open(V).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') c.put(req, res.clone()).catch(() => {});
      return res;
    }))));
  }
});
