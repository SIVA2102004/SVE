// SVE Auto-Update Service Worker
// Automatically skips waiting and activates new version instantly
const CACHE_NAME = 'sve-cache-v2';

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for old tabs/windows to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first strategy for HTML and API: Always fetch latest from server
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // For navigation requests (loading index.html / pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Pass through all other requests with network fallback
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
