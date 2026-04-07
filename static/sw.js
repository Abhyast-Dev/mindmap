const CACHE_NAME = 'able-v1';

// Use absolute paths and ensure EXACT case matching with your files
const assets = [
  '/',
  '/Logo.png', // Change to /Logo.png ONLY if the file is uppercase
  
  '/manifest.json' // Added manifest to ensure offline install works
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('ABLE™ SW: Caching Assets');
      return cache.addAll(assets);
    })
  );
});

self.addEventListener('activate', e => {
  // Clean up old caches if you update the CACHE_NAME
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request).catch(() => {
        // Optional: Return a fallback if network fails and not in cache
        console.log('ABLE™ SW: Fetch failed, asset not in cache');
      });
    })
  );
});