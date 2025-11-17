// sw.js (ОКОНЧАТЕЛЬНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ - v7)
const CACHE_NAME = 'agitator-notebook-cache-v7'; // УВЕЛИЧЕННАЯ ВЕРСИЯ

// Список файлов, которые должны быть кешированы при установке Service Worker
const urlsToCache = [
    // Основные файлы приложения (используем относительные пути для надежности)
    './', 
    './index.html',
    './admin_dashboard.html',
    './manifest.json',
    
    // Скрипты (УДАЛЕН /config.js)
    './firebase-auth.js',
    './reports.js',
    './main.js',
    './offline_db.js', 
    
    // Ресурсы
    './icons/icon-192.png',
    './icons/icon-512.png',

    // Критические CDN библиотеки (Tailwind удален из этого списка, но кэшируется ниже)
    'https://unpkg.com/lucide@latest',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js',
    'https://telegram.org/js/telegram-web-app.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
    'https://api-maps.yandex.ru/2.1/loader.js' // Добавляем Yandex Maps Loader, если он используется
];

/**
 * Обработчик установки Service Worker: кэширует каждый файл по отдельности (безопасный способ).
 */
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async (cache) => {
                let failureCount = 0;
                
                for (const url of urlsToCache) {
                    try {
                        // Используем cache.add() с try/catch для обхода ошибки cache.addAll/404/CORS
                        await cache.add(url); 
                    } catch (e) {
                        console.warn(`SW cache skip: ${url} (Error: ${e.message})`);
                        failureCount++;
                    }
                }
                
                if (failureCount > 0) {
                     console.warn('Service Worker installed with errors in caching.');
                } else {
                     console.log('Service Worker installed and all files cached successfully.');
                }
                
                return true;
            })
    );
});

/**
 * Обработчик активации: удаляет старые кэши.
 */
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Удаление старого кэша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

/**
 * Обработчик fetch: стратегия Network First (для API/отчетов) и Cache First (для статики) с Runtime Caching.
 */
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // 1. Runtime caching для шрифтов Google и CDN Tailwind (Cache First with Network Fallback)
    if (requestUrl.hostname.includes('fonts.googleapis.com') || 
        requestUrl.hostname.includes('fonts.gstatic.com') ||
        requestUrl.hostname.includes('cdn.tailwindcss.com')) 
    {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                // Пытаемся взять из сети, но кэш возвращаем немедленно
                const networkFetch = fetch(event.request).then(response => {
                    // Кэшируем новый ответ
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, response.clone());
                    });
                    return response;
                }).catch(() => cachedResponse); // При сбое сети отдаем старый кэш
                
                return cachedResponse || networkFetch;
            })
        );
        return;
    }

    // 2. Исключаем запросы Firebase и Dadata API (Network First)
    if (requestUrl.hostname.includes('googleapis.com') ||
        requestUrl.hostname.includes('firebaseio.com') ||
        requestUrl.hostname.includes('dadata.ru') ||
        requestUrl.hostname.includes('api-maps.yandex.ru')) 
    {
        // Network Only (без сохранения в кэш)
        event.respondWith(
            fetch(event.request).catch(error => {
                 console.log('Сбой сетевого запроса (API):', error);
                 throw error; 
            })
        );
        return;
    }
    
    // 3. Для всех остальных (статических) ресурсов: Cache First
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
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    }
                ).catch(error => {
                     console.error('Service Worker: Fetch failed (static resource)', error);
                     // На этом этапе можно вернуть запасную страницу, но лучше вернуть ошибку
                     throw error; 
                });
            })
    );
});
