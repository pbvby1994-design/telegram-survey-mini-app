// sw.js (Service Worker)
const CACHE_NAME = 'agitator-notebook-cache-v2';

// Список файлов, которые должны быть кешированы при установке Service Worker
const urlsToCache = [
    // Основные файлы приложения
    '/', 
    '/index.html',
    '/admin_dashboard.html',
    '/manifest.json',
    
    // Скрипты
    '/config.js',
    '/firebase-auth.js',
    '/main.js',
    '/reports.js',

    // Критические CDN библиотеки
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js',
    'https://telegram.org/js/telegram-web-app.js',
    
    // Firebase Modular SDK (v9+ compatibility)
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
    
    // Leaflet (УДАЛЕН)
];

// 1. Событие INSTALL: Кеширование всех необходимых ресурсов
self.addEventListener('install', event => {
    console.log('Service Worker: Установка v2');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Кеширование ресурсов:', urlsToCache);
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                 console.error('Service Worker: Ошибка при кешировании:', error);
            })
    );
});

// 2. Событие ACTIVATE: Удаление старого кеша
self.addEventListener('activate', event => {
    console.log('Service Worker: Активация v2');
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Service Worker: Удаление старого кеша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 3. Событие FETCH: Стратегия Cache First
self.addEventListener('fetch', event => {
    if (!event.request.url.startsWith('http')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }

                return fetch(event.request).then(
                    networkResponse => {
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }

                        const responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                // ИСКЛЮЧЕНИЕ: Не кешируем API и Yandex Maps
                                if (!event.request.url.includes('firebase') && !event.request.url.includes('api-maps.yandex.ru') && !event.request.url.includes('dadata.ru')) {
                                     cache.put(event.request, responseToCache);
                                }
                            });

                        return networkResponse;
                    }
                ).catch(error => {
                    console.error('Fetch failed; returning offline page.', error);
                });
            })
    );
});
