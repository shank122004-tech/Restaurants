// Service Worker for RestaurantOS
const CACHE_NAME = 'restaurantos-v12';
const URLS_TO_CACHE = [
    '/',
    '/app.js',
    '/style.css',
    '/manifest.json'
];

// Install event - cache essential files
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching files');
                return cache.addAll(URLS_TO_CACHE);
            })
            .catch(error => console.error('[Service Worker] Cache error:', error))
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - Network first for HTML documents and customer pages, Cache first for static assets
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    const url = new URL(event.request.url);
    
    // NEVER cache HTML documents with restaurant parameter (customer pages)
    // Customer pages must always fetch fresh menu data from server
    if (event.request.destination === 'document' || url.searchParams.has('restaurant')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (!response || response.status !== 200) {
                        return response;
                    }
                    // Don't cache customer pages - always get fresh menu data
                    // This ensures customers see the latest menu items and prices
                    return response;
                })
                .catch(() => {
                    // If network fails, try cache
                    return caches.match(event.request)
                        .then(response => {
                            if (response) return response;
                            // Return index.html as fallback
                            return caches.match('/index.html');
                        });
                })
        );
        return;
    }

    // Cache first for static assets (JS, CSS, images, etc)
    // This reduces bandwidth usage for frequently accessed static files
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    console.log('[Service Worker] Serving from cache:', event.request.url);
                    return response;
                }
                return fetch(event.request)
                    .then(response => {
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        return response;
                    })
                    .catch(() => {
                        if (event.request.destination === 'document') {
                            return caches.match('/index.html');
                        }
                    });
            })
    );
});

// Background sync for orders when online
self.addEventListener('sync', event => {
    if (event.tag === 'sync-orders') {
        event.waitUntil(
            fetch('/api/sync-orders', {
                method: 'POST',
                body: JSON.stringify({
                    timestamp: new Date().toISOString()
                })
            })
            .then(response => response.json())
            .catch(error => console.error('Sync error:', error))
        );
    }
});

// Push notifications
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'New notification from RestaurantOS',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'restaurantos-notification',
        requireInteraction: true
    };

    event.waitUntil(
        self.registration.showNotification('RestaurantOS', options)
    );
});

// Notification click
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                if (clientList.length > 0) {
                    return clientList[0].focus();
                }
                return clients.openWindow('/');
            })
    );
});

// Message handling from clients
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME);
    }
});

console.log('[Service Worker] Ready');