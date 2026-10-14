/* Rentals app offline start. Pages and their files come from the network when there is signal (so updates show at
   once) and from this cache when there isn't. Calls to the API and Google are never cached. The cache name is stamped
   by build-app.js on every build. */
var CACHE = 'rentals-2026.10.14-32d5c19';
var FILES = ['./', 'index.html', 'shell.css', 'signin.js', 'api.js', 'config.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png',
  'fi/', 'fi/index.html', 'fi/app.js', 'tm/', 'tm/index.html', 'tm/app.js'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
    .then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // with signal, always ask GitHub whether the file changed (never the browser's 10-minute copy), so updates land
  e.respondWith(fetch(new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })).then(function (r) {
    if (r.ok) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
    return r;
  }).catch(function () {
    return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match(new URL('./', self.registration.scope).href); });
  }));
});
