// sw.js (Service Worker)
const CACHE_NAME = 'agitator-notebook-cache-v1';

// Список файлов, которые должны быть кешированы при установке Service Worker
const urlsToCache = [
    // Основные файлы приложения
    '/', // Главная страница (если это корень)
    '/admin_dashboard.html',
    '/manifest.json',

    // Критические CDN библиотеки
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js',

    // Leaflet Maps
    'https://unpkg.com/leaflet/dist/leaflet.css',
    'https://unpkg.com/leaflet/dist/leaflet.js',
    'https://unpkg.com/leaflet-heat/dist/leaflet-heat.js',
    'https://unpkg.com/leaflet.markercluster/dist/leaflet.markercluster.js',
    'https://unpkg.com/leaflet.markercluster/dist/MarkerCluster.css',
    'https://unpkg.com/leaflet.markercluster/dist/MarkerCluster.Default.css'
];

// 1. Событие INSTALL: Кеширование всех необходимых ресурсов
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Кеширование ресурсов:', urlsToCache);
                return cache.addAll(urlsToCache);
            })
    );
});

// 2. Событие ACTIVATE: Удаление старых версий кеша
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Удаление старого кеша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 3. Событие FETCH: Перехват сетевых запросов
self.addEventListener('fetch', event => {
    // Не перехватываем запросы к Firebase и Nominatim (они всегда должны быть свежими)
    if (event.request.url.includes('firebase') || event.request.url.includes('nominatim.openstreetmap.org')) {
        return fetch(event.request);
    }

    // Для остальных ресурсов: сначала ищем в кеше, при неудаче - идем в сеть
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Возвращаем из кеша, если найдено
                if (response) {
                    return response;
                }

                // Иначе делаем запрос к сети
                return fetch(event.request).then(
                    networkResponse => {
                        // Проверяем, что запрос прошел успешно и не является расширением (например, chrome-extension://)
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }

                        // Клонируем ответ, т.к. его можно прочитать только один раз
                        const responseToCache = networkResponse.clone();

                        // Добавляем новый ресурс в кеш (для обновления)
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    }
                ).catch(error => {
                    // Это место для обработки полного оффлайна
                    console.error('Fetch failed; returning offline page.', error);
                });
            })
    );
});