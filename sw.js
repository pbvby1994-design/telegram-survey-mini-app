// sw.js (Service Worker)

const CACHE_NAME = 'agitator-notebook-cache-v2';

// Список файлов, которые должны быть кешированы при установке Service Worker
const urlsToCache = [
    '/', 
    '/index.html',
    '/admin_dashboard.html',
    '/manifest.json',

    // Скрипты
    '/config.js',
    '/firebase-auth.js',
    '/main.js',
    '/reports.js',

    // CDN, которые критичны для офлайн-работы
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

// -------------------------
// УСТАНОВКА SW
// -------------------------
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

// -------------------------
// АКТИВАЦИЯ SW
// -------------------------
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// -------------------------
// ОБРАБОТКА FETCH
// -------------------------
self.addEventListener('fetch', event => {
    const request = event.request;

    event.respondWith(
        caches.match(request).then(cachedResponse => {

            if (cachedResponse) return cachedResponse;

            return fetch(request)
                .then(networkResponse => {

                    // Не кешируем API + Яндекс карты
                    if (
                        !request.url.includes('api-maps.yandex.ru') &&
                        !request.url.includes('dadata.ru') &&
                        request.method === 'GET'
                    ) {
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, networkResponse.clone());
                        });
                    }

                    return networkResponse;
                })
                .catch(() => {
                    console.warn('Fetch failed, offline fallback');
                });
        })
    );
});
