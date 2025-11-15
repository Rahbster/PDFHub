const CACHE_NAME = 'pdf-hub-pwa-cache-v4';
const localUrlsToCache = [
    './',
    './index.html',
    './css/style.css',
    './js/main.js',
    './sw.js',
    './manifest.json'
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

    // "Cache then Network" strategy for GET requests.
    event.respondWith(
        (async () => { // IIFE (Immediately Invoked Function Expression)
            const cache = await caches.open(CACHE_NAME);
            const cachedResponse = await cache.match(event.request);

            try {
                // Network First: Try to fetch a fresh version from the network.
                const networkResponse = await fetch(event.request);

                // If the fetch is successful, cache the new response and return it.
                // We only cache valid responses (status 200-299) to avoid caching errors.
                if (networkResponse.ok) {
                    cache.put(event.request, networkResponse.clone());
                }
                
                return networkResponse;
            } catch (error) {
                // Network failed, so fall back to the cached version if it exists.
                return cachedResponse;
            }
        })()
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