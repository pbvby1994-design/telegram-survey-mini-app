// sw.js (ОКОНЧАТЕЛЬНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ - v7)
const CACHE_NAME = 'agitator-notebook-cache-v7'; // УВЕЛИЧЕННАЯ ВЕРСИЯ

// Список файлов, которые должны быть кешированы при установке Service Worker
const urlsToCache = [
    // Основные файлы приложения (используем относительные пути для надежности)
    './',
    './index.html',
    './admin_dashboard.html',
    './manifest.json',

    // Скрипты (УДАЛЕН /config.js, потому что конфигурация в Base64)
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
    'https://api-maps.yandex.ru/2.1/loader.js', // Добавляем лоадер Yandex Maps
    'https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600;700&display=swap', // Google Font CSS
    'https://fonts.gstatic.com/s/jost/v14/92zFEztrsmI_O_E_FqXkLRs.woff2' // Google Font File
];

// --- УСТАНОВКА (Install) ---
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing cache v7...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                // ВАЖНО: cache.addAll завершится ошибкой, если хотя бы один файл не будет загружен.
                // В списке URLsToCache только те файлы, которые точно доступны.
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting()) // Активируем сразу
            .catch(error => {
                console.error('Service Worker: Cache install failed:', error);
                // Продолжаем, даже если install не сработал (например, из-за CDN)
            })
    );
});

// --- АКТИВАЦИЯ (Activate) ---
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating cache v7...');
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});


// --- ЗАПРОСЫ (Fetch) ---
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. Стратегия Network First (для API / Firebase / Dadata)
    // Эти запросы должны идти только в сеть, так как данные постоянно меняются.
    const isAPICall = event.request.method === 'POST' ||
                      event.request.url.includes('firestore.googleapis.com') ||
                      event.request.url.includes('suggestions.dadata.ru');

    if (isAPICall) {
        // Network Only (без сохранения в кэш)
        event.respondWith(
            fetch(event.request).catch(error => {
                 console.log('Сбой сетевого запроса (API):', error);
                 // КРИТИЧЕСКИ ВАЖНО: Бросаем ошибку, чтобы main.js мог поймать ее
                 // и сохранить отчет в IndexedDB (оффлайн-логика).
                 throw error;
            })
        );
        return;
    }


    // 2. Стратегия Cache First с обновлением из сети (для Tailwind CDN)
    // Tailwind генерируется динамически, но нам нужно его закешировать для оффлайна.
    if (url.href.includes('cdn.tailwindcss.com')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                const networkFetch = fetch(event.request).then(response => {
                    // Кэшируем новый ответ, если он валиден
                    if (response && response.status === 200) {
                       const responseToCache = response.clone();
                       caches.open(CACHE_NAME).then(cache => {
                           cache.put(event.request, responseToCache);
                       });
                    }
                    return response;
                }).catch(() => cachedResponse); // В случае сбоя сети возвращаем кэш

                // Если есть кэш, возвращаем его сразу, но обновляем в фоне
                return cachedResponse || networkFetch;
            })
        );
        return;
    }

    // 3. Для всех остальных (статических) ресурсов: Cache First
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // 3.1. Возвращаем из кэша, если есть
                if (response) {
                    return response;
                }

                // 3.2. Иначе, запрашиваем из сети и кэшируем
                return fetch(event.request).then(
                    networkResponse => {
                        // Проверяем валидность ответа перед кэшированием
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }

                        const responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                // Кэшируем только статику
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
