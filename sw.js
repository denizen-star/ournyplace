var CACHE_VERSION = 120;
var CACHE_NAME = 'nyhome-v' + CACHE_VERSION;

var APP_SHELL = [
  '/',
  '/index.html',
  '/admin',
  '/admin/',
  '/admin/index.html',
  '/admin/new',
  '/admin/new/',
  '/admin/new/index.html',
  '/details/',
  '/details/index.html',
  '/manifest.json',
  '/assets/img/favicon1.png',
  '/assets/css/app.css?v=' + CACHE_VERSION,
  '/assets/js/apartmentStatus.js?v=' + CACHE_VERSION,
  '/assets/js/statusFilterGroups.js?v=' + CACHE_VERSION,
  '/assets/js/listingStar.js?v=' + CACHE_VERSION,
  '/assets/js/shortlistSort.js?v=' + CACHE_VERSION,
  '/assets/js/listingTextParse.js?v=' + CACHE_VERSION,
  '/assets/js/apartmentSavePayload.js?v=' + CACHE_VERSION,
  '/assets/js/nyhomeUiFeedback.js?v=' + CACHE_VERSION,
  '/assets/js/saveApartmentWorkflow.js?v=' + CACHE_VERSION,
  '/assets/js/api.js?v=' + CACHE_VERSION,
  '/assets/js/app.js?v=' + CACHE_VERSION,
  '/assets/js/vibeImages.js?v=' + CACHE_VERSION,
  '/assets/js/admin.js?v=' + CACHE_VERSION,
  '/assets/js/details.js?v=' + CACHE_VERSION,
  '/assets/img/new.png',
  '/assets/img/evaluating.png',
  '/assets/img/shortlisted.png',
  '/assets/img/tour_scheduled.png',
  '/assets/img/toured.png',
  '/assets/img/finalist.png',
  '/assets/img/applying.png',
  '/assets/img/applied.png',
  '/assets/img/approved.png',
  '/assets/img/lease_review.png',
  '/assets/img/signed.png',
  '/assets/img/rejected.png',
  '/assets/img/blacklisted.png',
  '/assets/img/archived.png',
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
