/* eslint-env serviceworker */
const CACHE_NAME = 'feeds-cache-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/icon.png',
    '/assets/favicon.png',
];

// Store the user's accent color (set via postMessage from the app)
let userAccentColor = '#10b981'; // Default emerald

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SET_ACCENT_COLOR') {
        userAccentColor = event.data.color;
        console.log('[SW] Accent color updated:', userAccentColor);
    }
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Intercept manifest.json and serve dynamic version with accent color
    if (url.pathname === '/manifest.json') {
        event.respondWith(
            fetch(event.request)
                .then((response) => response.json())
                .then((manifest) => {
                    // Update theme_color with user's accent color
                    const dynamicManifest = {
                        ...manifest,
                        theme_color: userAccentColor,
                        background_color: userAccentColor,
                    };
                    
                    return new Response(
                        JSON.stringify(dynamicManifest),
                        {
                            headers: {
                                'Content-Type': 'application/json',
                                'Cache-Control': 'no-cache',
                            },
                        }
                    );
                })
                .catch(() => {
                    // Fallback to cached manifest
                    return caches.match(event.request);
                })
        );
        return;
    }

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
