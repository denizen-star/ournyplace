var CACHE_VERSION = 7;
var CACHE_NAME = 'nyhome-v' + CACHE_VERSION;

var APP_SHELL = [
  '/',
  '/index.html',
  '/admin',
  '/admin/',
  '/admin/index.html',
  '/details/',
  '/details/index.html',
  '/manifest.json',
  '/assets/css/app.css?v=' + CACHE_VERSION,
  '/assets/js/apartmentStatus.js?v=' + CACHE_VERSION,
  '/assets/js/api.js?v=' + CACHE_VERSION,
  '/assets/js/app.js?v=' + CACHE_VERSION,
  '/assets/js/admin.js?v=' + CACHE_VERSION,
  '/assets/js/details.js?v=' + CACHE_VERSION,
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(APP_SHELL.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (name) {
        return name !== CACHE_NAME;
      }).map(function (name) {
        return caches.delete(name);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request).catch(function () {
      return caches.match(event.request);
    }));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request);
    })
  );
});
