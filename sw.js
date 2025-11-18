const CACHE_NAME = 'pdf-hub-pwa-cache-v13';
const localUrlsToCache = [
    './',
    './index.html',
    './css/style.css',
    './js/main.js',
    './sw.js',
    './manifest.json',
    './README.md',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

const externalUrlsToCache = [
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
    'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            console.log('[Service Worker] Caching all: app shell and content');
            await cache.addAll([...localUrlsToCache, ...externalUrlsToCache]);
        })()
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'skipWaiting') {
        console.log('[Service Worker] Skipping waiting and activating new version.');
        self.skipWaiting();
        // After skipping waiting, we must claim the clients to take control immediately.
        self.clients.claim();
    }
});

self.addEventListener('fetch', (event) => {
    // Only apply caching strategy for GET requests.
    // Other requests (like POST to Firebase) should be passed through.
    if (event.request.method !== 'GET') {
        return;
    }

    // "Cache First" (Cache, falling back to Network) strategy.
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // If the response is in the cache, return it.
            if (cachedResponse) {
                return cachedResponse;
            }

            // If not in cache, fetch from the network.
            const fetchRequest = event.request.clone();

            return fetch(fetchRequest).then((networkResponse) => {
                // Check if we received a valid response
                if (!networkResponse || networkResponse.status !== 200 && networkResponse.type !== 'opaque') {
                    return networkResponse;
                }

                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            });
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});