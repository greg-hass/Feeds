/* eslint-env serviceworker */
const CACHE_NAME = 'feeds-cache-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/icon.png',
    '/assets/favicon.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // For API requests, use network-first strategy
    if (url.pathname.startsWith('/api/v1/articles')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const clonedResponse = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clonedResponse);
                    });
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
        return;
    }

    // For other requests (assets), use cache-first strategy
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
