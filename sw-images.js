'use strict';

var CACHE_NAME = 'hildernw-images-v2';
var IMAGE_RE = /\/assets\/images\/.+\.(jpe?g|png|webp|gif)(\?|$)/i;

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key.indexOf('hildernw-images-') === 0 && key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || !IMAGE_RE.test(req.url)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(req).then(function (cached) {
        if (cached) return cached;

        return fetch(req).then(function (res) {
          if (res && res.ok) {
            cache.put(req, res.clone());
          }
          return res;
        });
      });
    })
  );
});
