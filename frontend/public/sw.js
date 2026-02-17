/* eslint-env serviceworker */
const CACHE_NAME = 'feeds-cache-v2';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/icon.png',
    '/assets/favicon.png',
];

// Store the user's accent color (set via postMessage from the app)
let userAccentColor = '#10b981'; // Default emerald

// Background sync configuration
const SYNC_TAG = 'feeds-background-sync';
const LAST_SYNC_KEY = 'last-background-sync';
const SYNC_INTERVAL_MINUTES = 5; // Check for updates every 5 minutes when possible

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SET_ACCENT_COLOR') {
        userAccentColor = event.data.color;
        console.log('[SW] Accent color updated:', userAccentColor);
    }
    
    if (event.data && event.data.type === 'TRIGGER_BACKGROUND_SYNC') {
        // Trigger immediate background sync
        event.waitUntil(
            performBackgroundSync().catch(err => {
                console.error('[SW] Background sync failed:', err);
            })
        );
    }
});

// Handle periodic background sync
self.addEventListener('periodicsync', (event) => {
    if (event.tag === SYNC_TAG) {
        console.log('[SW] Periodic sync triggered');
        event.waitUntil(performBackgroundSync());
    }
});

// Handle one-shot background sync (fallback for browsers without periodic sync)
self.addEventListener('sync', (event) => {
    if (event.tag === SYNC_TAG) {
        console.log('[SW] One-shot sync triggered');
        event.waitUntil(performBackgroundSync());
    }
});

/**
 * Perform background sync - fetch latest articles and update cache
 * This runs in the background even when the app is closed
 */
async function performBackgroundSync() {
    try {
        // Check if enough time has passed since last sync
        const lastSync = await getLastSyncTime();
        const now = Date.now();
        const minutesSinceLastSync = (now - lastSync) / (1000 * 60);
        
        if (minutesSinceLastSync < SYNC_INTERVAL_MINUTES) {
            console.log('[SW] Skipping sync - too soon since last sync');
            return;
        }
        
        console.log('[SW] Performing background sync...');
        
        // Fetch latest articles from the API (backend already refreshed these)
        const apiUrl = self.location.origin + '/api/v1/articles?limit=50&unread_only=true';
        const response = await fetch(apiUrl, {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Update the cache with fresh data
        const cache = await caches.open(CACHE_NAME);
        await cache.put(apiUrl, new Response(JSON.stringify(data), {
            headers: {
                'Content-Type': 'application/json',
                'X-Background-Sync': 'true',
                'Date': new Date().toUTCString()
            }
        }));
        
        // Also fetch feeds and folders to keep everything fresh
        await Promise.all([
            fetchAndCache('/api/v1/feeds'),
            fetchAndCache('/api/v1/folders'),
            fetchAndCache('/api/v1/settings')
        ]);
        
        // Update last sync time
        await setLastSyncTime(now);
        
        console.log('[SW] Background sync completed successfully');
    } catch (error) {
        console.error('[SW] Background sync error:', error);
        throw error;
    }
}

/**
 * Fetch and cache a URL
 */
async function fetchAndCache(url) {
    try {
        const fullUrl = url.startsWith('http') ? url : self.location.origin + url;
        const response = await fetch(fullUrl, { credentials: 'include' });
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(fullUrl, response.clone());
        }
    } catch (error) {
        console.error(`[SW] Failed to cache ${url}:`, error);
    }
}

/**
 * Get last sync time from cache
 */
async function getLastSyncTime() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match('last-sync-time');
        if (response) {
            const data = await response.json();
            return data.timestamp || 0;
        }
    } catch (e) {
        // Ignore errors
    }
    return 0;
}

/**
 * Set last sync time in cache
 */
async function setLastSyncTime(timestamp) {
    try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put('last-sync-time', new Response(JSON.stringify({ timestamp }), {
            headers: { 'Content-Type': 'application/json' }
        }));
    } catch (e) {
        // Ignore errors
    }
}

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
    // This ensures the UI gets fresh data when online, with cache fallback offline
    if (url.pathname.startsWith('/api/v1/articles') || 
        url.pathname.startsWith('/api/v1/feeds') ||
        url.pathname.startsWith('/api/v1/folders') ||
        url.pathname.startsWith('/api/v1/settings')) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.ok) {
                        const clonedResponse = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, clonedResponse);
                        });
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    const cachedResponse = await caches.match(event.request);
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return new Response(JSON.stringify({ error: 'Network error' }), {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' },
                    });
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
