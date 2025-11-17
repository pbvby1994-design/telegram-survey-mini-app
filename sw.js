// sw.js (Service Worker - ОКОНЧАТЕЛЬНАЯ ВЕРСИЯ С PWA ЛОГИКОЙ)
const CACHE_NAME = 'agitator-notebook-cache-v3'; // УВЕЛИЧЕННАЯ ВЕРСИЯ

// Список файлов, которые должны быть кешированы при установке Service Worker
const urlsToCache = [
    // Основные файлы приложения
    '/', 
    '/index.html',
    '/admin_dashboard.html',
    '/manifest.json',
    
    // Скрипты
    // '/config.js', // ❌ УДАЛЕНО: Файл пуст и не существует, вызывает ошибку 404
    './firebase-auth.js',
    './reports.js',
    './main.js',
    './offline_db.js', 
    
    // CSS, иконки (убедитесь, что папка icons существует)
    './icons/icon-192.png',
    './icons/icon-512.png',
    
    // Критические CDN библиотеки (Firebase, Chart.js, Tailwind, Lucide, Telegram WebApp)
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js',
    'https://telegram.org/js/telegram-web-app.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
    // ... Добавьте другие важные шрифты/ресурсы CDN, если они используются
];

/**
 * Обработчик установки Service Worker: кэширует все необходимые файлы.
 */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                // Проверяем, что все пути начинаются с `./` для относительной корректности
                return cache.addAll(urlsToCache); 
            })
            .catch(error => {
                console.error('Service Worker: cache.addAll failed:', error);
                // Важно: если addAll падает, SW не будет установлен.
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
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

/**
 * Обработчик fetch: стратегия Cache First (для статики) и Network First (для API/отчетов).
 */
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // 1. Исключаем запросы Firebase и Dadata API из кэширования
    // Они должны всегда идти в сеть (Network Only / Network First)
    if (requestUrl.hostname.includes('googleapis.com') ||
        requestUrl.hostname.includes('firebaseio.com') ||
        requestUrl.hostname.includes('dadata.ru') ||
        requestUrl.pathname.includes('/auth') || 
        requestUrl.pathname.includes('/rs/suggest')) 
    {
        // Network Only - идем только в сеть
        event.respondWith(
            fetch(event.request).catch(error => {
                 console.error('Service Worker: Firebase/Dadata fetch failed (Network Only)', error);
                 // Не перехватываем ошибку здесь, чтобы main.js мог сохранить оффлайн
                 throw error; 
            })
        );
        return;
    }
    
    // 2. Для всех остальных (статических) ресурсов: Cache First
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // 1. Возвращаем из кэша, если есть
                if (response) {
                    return response;
                }

                // 2. Иначе, запрашиваем из сети и кэшируем
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
                     throw error; 
                });
            })
    );
});
