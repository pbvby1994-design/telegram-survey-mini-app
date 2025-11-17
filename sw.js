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
    '/firebase-auth.js',
    '/reports.js',
    '/main.js',
    '/offline_db.js',
    
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
    'https://fonts.gstatic.com'
];

// ----------------------------------------------------------------------
// INSTALLATION
// ----------------------------------------------------------------------

self.addEventListener('install', event => {
    // Пропускаем ожидание и активируем SW немедленно
    self.skipWaiting(); 
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                // Добавляем все критические ресурсы в кэш
                return cache.addAll(urlsToCache); 
            })
    );
});

// ----------------------------------------------------------------------
// ACTIVATION
// ----------------------------------------------------------------------

self.addEventListener('activate', event => {
    // Заставляем Service Worker контролировать все страницы немедленно
    event.waitUntil(self.clients.claim()); 
    
    event.waitUntil(
        // Удаляем старые кэши
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// ----------------------------------------------------------------------
// FETCHING
// ----------------------------------------------------------------------

self.addEventListener('fetch', event => {
    // Пропускаем запросы Firebase Firestore, чтобы они всегда шли в сеть
    if (event.request.url.includes('firestore.googleapis.com')) {
        return;
    }
    
    // Пропускаем запросы Dadata и Yandex Maps, чтобы они всегда шли в сеть (Network Only)
    if (event.request.url.includes('suggestions.dadata.ru') || 
        event.request.url.includes('api-maps.yandex.ru')) {
        event.respondWith(
            fetch(event.request).catch(error => {
                 console.error('Service Worker: Fetch failed (API)', error);
                 // Здесь важно не возвращать ошибку, чтобы main.js мог сохранить оффлайн
                 throw error; 
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
