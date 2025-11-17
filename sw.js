// sw.js (ИСПРАВЛЕННАЯ ВЕРСИЯ - ИСПОЛЬЗУЕТ try/catch ДЛЯ cache.add)
const CACHE_NAME = 'agitator-notebook-cache-v4'; // УВЕЛИЧЕННАЯ ВЕРСИЯ

// Список файлов, которые должны быть кешированы при установке Service Worker
const urlsToCache = [
    // Основные файлы приложения
    './', // Корневой путь
    './index.html',
    './admin_dashboard.html',
    './manifest.json',
    
    // Скрипты
    './firebase-auth.js',
    './reports.js',
    './main.js',
    './offline_db.js', 
    
    // Ресурсы
    './icons/icon-192.png',
    './icons/icon-512.png',
    
    // Критические CDN библиотеки
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js',
    'https://telegram.org/js/telegram-web-app.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
];

/**
 * Обработчик установки Service Worker: кэширует каждый файл по отдельности.
 */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async (cache) => {
                console.log('Opened cache');
                
                let successCount = 0;
                let failureCount = 0;
                
                for (const url of urlsToCache) {
                    try {
                        // Используем cache.add() для каждого файла
                        await cache.add(url); 
                        successCount++;
                    } catch (e) {
                        // Если файл не найден (404) или запрос не удался, мы просто предупреждаем и пропускаем его
                        console.warn(`SW cache skip: ${url} (Error: ${e.message})`);
                        failureCount++;
                    }
                }
                
                if (failureCount > 0) {
                     console.warn(`Service Worker installed with ${successCount} files, but ${failureCount} failed to cache.`);
                } else {
                     console.log('Service Worker installed and all files cached successfully.');
                }
                
                return true;
            })
    );
});


// Обработчики activate и fetch остаются без изменений
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
    if (requestUrl.hostname.includes('googleapis.com') ||
        requestUrl.hostname.includes('firebaseio.com') ||
        requestUrl.hostname.includes('dadata.ru') ||
        requestUrl.pathname.includes('/auth') || 
        requestUrl.pathname.includes('/rs/suggest')) 
    {
        event.respondWith(
            fetch(event.request).catch(error => {
                 throw error; 
            })
        );
        return;
    }
    
    // 2. Для всех остальных (статических) ресурсов: Cache First
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
                     throw error; 
                });
            })
    );
});
