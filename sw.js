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
    '/config.js',
    '/firebase-auth.js',
    '/reports.js',
    '/main.js',
    '/offline_db.js', // [НОВОЕ]
    
    // Критические CDN библиотеки (Firebase, Chart.js, Tailwind, Lucide, Telegram WebApp)
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js',
    'https://telegram.org/js/telegram-web-app.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
    
    // Шрифты
    'https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600;700&display=swap',
    'https://fonts.gstatic.com',
    
    // Иконки
    '/icons/icon-192.png',
    '/icons/icon-512.png',
];

// 1. Событие INSTALL: Кеширование всех необходимых ресурсов
self.addEventListener('install', event => {
    self.skipWaiting(); // Принудительно активируем новый SW сразу
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Предварительное кэширование завершено');
                return cache.addAll(urlsToCache).catch(error => {
                    console.error('Service Worker: Ошибка при кэшировании некоторых ресурсов (возможно, CDN):', error);
                });
            })
    );
});

// 2. Событие ACTIVATE: Очистка старых кэшей
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Удаление старого кэша', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 3. Событие FETCH: Смешанная стратегия (Cache First для статики, Network First для API)
self.addEventListener('fetch', event => {
    const requestUrl = event.request.url;

    if (!requestUrl.startsWith('http')) {
        return;
    }
    
    // ИСКЛЮЧЕНИЕ: Сетевая стратегия для Firebase, Dadata и Yandex Maps (Network First)
    if (requestUrl.includes('firebase') || 
        requestUrl.includes('dadata.ru') || 
        requestUrl.includes('api-maps.yandex.ru')) {
        
        // Для динамических данных: Network First (попытка получить данные из сети, если сбой, просто пропускаем)
        event.respondWith(
            fetch(event.request).catch(error => {
                // В случае оффлайна, просто пусть приложение обработает ошибку
                console.log('Service Worker: Сбой сетевого запроса (Firebase/API) - оффлайн?');
                throw error; // Передаем ошибку обратно, чтобы main.js мог сохранить оффлайн
            })
        );
        return;
    }
    
    // Для всех остальных (статических) ресурсов: Cache First
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
