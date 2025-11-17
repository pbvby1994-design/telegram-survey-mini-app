// main.js (ФИНАЛЬНАЯ ВЕРСИЯ С АНИМАЦИЯМИ, PWA ОФФЛАЙН ЛОГИКОЙ И УСИЛЕННЫМ TRY-CATCH)

// --- Глобальные переменные ---
window.mapInstance = null; 
let dadataCoords = null;    

// --- КОНФИГУРАЦИЯ DADATA (Из URL-параметров) ---
const urlParams = new URLSearchParams(window.location.search);
// Ключ Dadata теперь передается как URL-параметр.
const DADATA_API_KEY = urlParams.get('dadata_token'); 
// Используем FIAS ID для ограничения поиска (дефолтное значение '86' для ХМАО).
const DADATA_LOCATION_FIAS_ID = urlParams.get('dadata_fias_id') || '86'; 

let selectedSuggestionData = null; 

const addressInput = document.getElementById('address');
const suggestionsList = document.getElementById('suggestionsList');
const addressStatus = document.getElementById('addressStatus');

// Переменные для отслеживания геолокации
let currentLatitude = null; 
let currentLongitude = null;

// --- КОНСТАНТЫ И ЭЛЕМЕНТЫ ФОРМЫ ---
const loyaltyInput = document.getElementById('loyalty');
const actionInput = document.getElementById('action');
const commentInput = document.getElementById('comment');
const settlementInput = document.getElementById('settlement');
const saveButton = document.getElementById('saveButton');
const infoContainer = document.getElementById('offlineInfoContainer');
const mapLoadingIndicator = document.getElementById('mapLoading');

// --- PWA: IndexedDB для оффлайн-отчетов ---

// Инициализация IndexedDB
const DB_NAME = 'AgitatorReportsDB';
const DB_VERSION = 1;
const STORE_NAME = 'offlineReports';

let dbRequest = indexedDB.open(DB_NAME, DB_VERSION);

dbRequest.onupgradeneeded = (event) => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { autoIncrement: true });
    }
};

dbRequest.onerror = (event) => {
    console.error("IndexedDB error:", event.target.errorCode);
};

window.getOfflineReports = function() {
    return new Promise((resolve, reject) => {
        dbRequest.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            const keyRequest = store.getAllKeys();

            request.onsuccess = () => {
                const reports = request.result.map((data, index) => ({
                    key: keyRequest.result[index], // Получаем ключ
                    data: data
                }));
                resolve(reports);
            };

            request.onerror = (event) => {
                reject("Error getting offline reports: " + event.target.error);
            };
        };
        dbRequest.onerror = (event) => reject("DB access error: " + event.target.error);
    });
};

window.saveOfflineReport = function(reportData) {
    return new Promise((resolve, reject) => {
        dbRequest.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.add({ ...reportData, saved_at: Date.now() });

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject("Error saving offline report: " + event.target.error);
        };
        dbRequest.onerror = (event) => reject("DB access error: " + event.target.error);
    });
};

window.deleteOfflineReport = function(key) {
     return new Promise((resolve, reject) => {
        dbRequest.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject("Error deleting offline report: " + event.target.error);
        };
        dbRequest.onerror = (event) => reject("DB access error: " + event.target.error);
    });
}

// --- СИНХРОНИЗАЦИЯ ОФФЛАЙН-ОТЧЕТОВ ---

window.syncOfflineReports = async function() {
    if (!window.db || !window.auth.currentUser) {
        console.warn("Cannot sync: Firebase or user not ready.");
        return;
    }
    
    const offlineReports = await window.getOfflineReports();
    if (offlineReports.length === 0) {
        return;
    }
    
    let syncCount = 0;
    // Сортируем по saved_at (самое старое), чтобы отправлять старые отчеты первыми
    offlineReports.sort((a, b) => a.data.saved_at - b.data.saved_at);

    for (const { key, data: report } of offlineReports) {
        const reportData = { ...report };
        delete reportData.saved_at; // Удаляем служебное поле
        reportData.timestamp = firebase.firestore.FieldValue.serverTimestamp(); 
        
        try {
            await window.db.collection('reports').add(reportData);
            await window.deleteOfflineReport(key);
            
            syncCount++;
            
        } catch (error) {
            console.warn(`Сбой синхронизации отчета (IDB Key: ${key}):`, error.message);
            // Если сбой, прекращаем попытки, чтобы не нагружать сеть или API
            break; 
        }
    }
    
    if (syncCount > 0) {
        window.showAlert('СИНХРОНИЗАЦИЯ', `✅ Успешно отправлено ${syncCount} оффлайн-отчетов в Firebase.`);
    }
    
    // Обновляем список отчетов и оффлайн-индикатор после синхронизации
    if (window.loadReports) {
        await window.loadReports(window.isAdmin ? 'all' : 'my');
    }
    const remainingReports = await window.getOfflineReports();
    if (infoContainer) {
        if (remainingReports.length === 0) {
             infoContainer.classList.add('hidden');
        } else {
             infoContainer.classList.remove('hidden');
             infoContainer.textContent = `💾 ${remainingReports.length} отчетов ожидают отправки (оффлайн).`;
        }
    }
}


// --- ФУНКЦИИ DADATA ---

/**
 * Ручной обработчик ввода для Dadata
 */
if (addressInput) {
    if (!DADATA_API_KEY) {
        console.error("DADATA_API_KEY не найден в URL. Поиск адресов Dadata будет недоступен.");
        if (addressStatus) {
            // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ (Строка 27): Используем ОДИН знак "="
            addressStatus.textContent = '⚠️ API Dadata недоступно. Обратитесь к администратору.';
        }
        addressInput.disabled = true;
    } else {
        addressInput.addEventListener('input', async () => {
            const query = addressInput.value.trim();
            if (query.length < 3) {
                suggestionsList?.innerHTML = '';
                suggestionsList?.classList.add('hidden');
                return;
            }

            try {
                const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
                    method: "POST",
                    mode: "cors",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "Authorization": "Token " + DADATA_API_KEY
                    },
                    body: JSON.stringify({
                        query: query,
                        count: 10,
                        locations: [{ "kladr_id": DADATA_LOCATION_FIAS_ID }]
                    })
                });

                if (!response.ok) {
                    throw new Error(`Dadata API returned status ${response.status}`);
                }

                const data = await response.json();
                renderSuggestions(data.suggestions);

            } catch (error) {
                console.error("Error fetching Dadata suggestions:", error);
                suggestionsList?.innerHTML = `<li class="p-2 text-red-500">Ошибка Dadata: ${error.message}</li>`;
                suggestionsList?.classList.remove('hidden');
            }
        });
    }
}


/**
 * Отображение списка предложений Dadata
 * @param {Array<Object>} suggestions 
 */
function renderSuggestions(suggestions) {
    suggestionsList.innerHTML = '';
    suggestionsList.classList.remove('hidden');

    if (!suggestions || suggestions.length === 0) {
        suggestionsList.innerHTML = `<li class="p-2 text-gray-500">Нет результатов.</li>`;
        return;
    }

    suggestions.forEach(suggestion => {
        const li = document.createElement('li');
        li.className = 'p-2 cursor-pointer hover:bg-indigo-100 rounded-md transition-colors';
        li.textContent = suggestion.value;
        li.addEventListener('click', () => {
            addressInput.value = suggestion.value;
            selectedSuggestionData = suggestion.data;
            dadataCoords = {
                latitude: selectedSuggestionData.geo_lat,
                longitude: selectedSuggestionData.geo_lon
            };
            suggestionsList.innerHTML = '';
            suggestionsList.classList.add('hidden');
            addressInput.classList.remove('border-red-500');
        });
        suggestionsList.appendChild(li);
    });
}

// --- ФУНКЦИИ ГЕОЛОКАЦИИ ---

/**
 * Получение текущей геолокации пользователя
 */
async function getCurrentLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            window.showAlert('Геолокация', '❌ Геолокация не поддерживается вашим браузером.');
            resolve({ latitude: null, longitude: null });
            return;
        }

        const success = (position) => {
            currentLatitude = position.coords.latitude;
            currentLongitude = position.coords.longitude;
            window.showAlert('Геолокация', `✅ Координаты получены: ${currentLatitude.toFixed(4)}, ${currentLongitude.toFixed(4)}`);
            resolve({ latitude: currentLatitude, longitude: currentLongitude });
        };

        const error = (err) => {
            console.warn(`Geolocation error (${err.code}): ${err.message}`);
            window.showAlert('Геолокация', '⚠️ Не удалось получить GPS координаты. Попробуйте ввести адрес вручную.');
            resolve({ latitude: null, longitude: null });
        };

        navigator.geolocation.getCurrentPosition(success, error, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        });
    });
}

// Привязка к кнопке "Определить по GPS"
const gpsButton = document.getElementById('gpsButton');
if (gpsButton) {
    gpsButton.addEventListener('click', getCurrentLocation);
}

// --- ФУНКЦИИ ОТПРАВКИ ОТЧЕТА ---

/**
 * Основная функция сохранения отчета
 */
window.saveReport = async function() {
    if (!window.auth || !window.auth.currentUser) {
         window.showAlert('ОШИБКА', 'Пользователь не аутентифицирован. Перезапустите приложение через бота.');
         return;
    }
    
    // 1. Сбор данных
    const reportData = {
        loyalty: loyaltyInput?.value,
        action: actionInput?.value,
        comment: commentInput?.value.trim(),
        settlement: settlementInput?.value,
        address: addressInput?.value.trim(),
        user_id: window.userTelegramId,
        username: window.userTelegramUsername || window.auth.currentUser.uid, // Fallback
        timestamp: null, // Будет заменено на serverTimestamp()
        latitude: currentLatitude || dadataCoords?.latitude || null,
        longitude: currentLongitude || dadataCoords?.longitude || null,
    };
    
    // 2. Валидация
    if (!reportData.settlement || !reportData.address || !reportData.loyalty || !reportData.action) {
        window.showAlert('ОШИБКА', 'Пожалуйста, заполните все обязательные поля (НП, Адрес, Лояльность, Действие).');
        if (!reportData.address) addressInput?.classList.add('border-red-500');
        return;
    }
    
    // Сбрасываем флаг, если адрес валиден
    if (reportData.address) addressInput?.classList.remove('border-red-500');

    // 3. Отправка в Firebase или сохранение оффлайн
    
    // Блокируем кнопку на время отправки
    saveButton?.setAttribute('disabled', 'true');
    saveButton.textContent = 'Отправка...';
    
    try {
        if (window.db) {
            // Online: Сохранение в Firebase
            reportData.timestamp = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await window.db.collection('reports').add(reportData);

            window.showAlert('УСПЕХ', '✅ Отчет успешно сохранен в облаке!');
            
            // Отправка данных о сохранении боту Telegram
            if (window.Telegram.WebApp) {
                window.Telegram.WebApp.sendData(JSON.stringify({ 
                    status: 'report_saved', 
                    reportId: docRef.id 
                }));
            }
        } else {
            // Offline: Сохранение в IndexedDB
            const key = await window.saveOfflineReport(reportData);
            window.showAlert('ОФФЛАЙН', '💾 Отчет сохранен локально. Будет отправлен при появлении сети.');
            
            // Показываем оффлайн-индикатор
            if (infoContainer) {
                 const reports = await window.getOfflineReports();
                 infoContainer.classList.remove('hidden');
                 infoContainer.textContent = `💾 ${reports.length} отчетов ожидают отправки (оффлайн).`;
            }
        }

        // 4. Очистка формы
        addressInput.value = '';
        commentInput.value = '';
        loyaltyInput.value = 'strong';
        actionInput.value = 'appeal';
        selectedSuggestionData = null;
        dadataCoords = null;
        currentLatitude = null;
        currentLongitude = null;
        
        // 5. Обновление списка отчетов, если это панель
        if (window.loadReports) {
            await window.loadReports(window.isAdmin ? 'all' : 'my');
        }

    } catch (error) {
        console.error("Error saving report:", error);
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', `Не удалось сохранить отчет: ${error.message}`);
    } finally {
        saveButton?.removeAttribute('disabled');
        saveButton.textContent = 'Сохранить Отчет';
    }
};

// Привязка к кнопке "Сохранить Отчет"
if (saveButton) {
    saveButton.addEventListener('click', window.saveReport);
}


// --- ИНИЦИАЛИЗАЦИЯ ПАНЕЛИ АДМИНА/АГИТАТОРА ---

window.loadDashboard = async function() {
    const initialView = new URLSearchParams(window.location.search).get('view') || 'form-view';
    const urlRole = new URLSearchParams(window.location.search).get('role') || 'agitator';
    
    // 1. Синхронизация оффлайн-отчетов при загрузке
    await window.syncOfflineReports();
    
    // 2. Инициализация карты (только если это Админ)
    if (urlRole === 'admin' && typeof ymaps !== 'undefined' && mapLoadingIndicator) {
         try {
             mapLoadingIndicator.classList.remove('hidden');
             // Инициализируется только, если ymaps уже загрузился
             await window.initMap(window.isAdmin); 
         } catch (error) {
             console.error("Map initialization failed:", error);
             window.showAlert('ОШИБКА КАРТЫ', 'Не удалось инициализировать карту. Возможно, отсутствует Yandex Maps API Key.');
         }
    }

    // 3. Запускаем проверку статуса (она также проверяет авторизацию)
    const isAuthenticated = await window.checkAdminStatus(); 

    if (isAuthenticated) {
        // 4. Настройка видимости кнопок навигации
        if (window.isAdmin) {
            // Админ видит все
            document.getElementById('btn-map-view')?.classList.remove('hidden');
            document.getElementById('btn-stats')?.classList.remove('hidden');
            document.getElementById('btn-raw-data')?.classList.remove('hidden');
            document.getElementById('btn-my-reports-view')?.classList.add('hidden');
        } else {
            // Агитатор видит только Форму и Мои Отчеты
            document.getElementById('btn-map-view')?.classList.add('hidden');
            document.getElementById('btn-stats')?.classList.add('hidden');
            document.getElementById('btn-raw-data')?.classList.add('hidden');
            document.getElementById('btn-my-reports-view')?.classList.remove('hidden');
        }

        // 5. Выбор начального раздела
        let startSection = initialView;
        
        // Если пользователь Админ, по умолчанию показываем карту
        if (window.isAdmin && startSection === 'form-view') {
             startSection = 'map-view';
        }
        
        // Если Агитатор пришел на панель Админа, показываем форму/отчеты
        if (!window.isAdmin && (startSection === 'map-view' || startSection === 'stats' || startSection === 'raw-data')) {
             startSection = 'form-view';
        }

        // 6. Загрузка данных (для админов и агитаторов)
        if (window.loadReports) {
             await window.loadReports(window.isAdmin ? 'all' : 'my');
        }

        // 7. Отображение раздела
        window.showSection(startSection);
        document.getElementById('saveButton')?.removeAttribute('disabled');
        
    } else {
         window.showSection('form-view');
         document.getElementById('saveButton')?.setAttribute('disabled', 'true');
         window.showAlert('Доступ ограничен', 'Не удалось пройти аутентификацию. Используйте бота для входа.');
         document.getElementById('authUsername').textContent = 'Не авторизован';
    }
};

// --- ИНИЦИАЛИЗАЦИЯ: ВЫЗЫВАЕТСЯ ИЗ HTML ---

window.onload = async () => {
    // Регистрация Service Worker для PWA
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('ServiceWorker registered:', registration);
        } catch (error) {
            console.error('ServiceWorker registration failed:', error);
        }
    }
    
    // Запуск анимации
    document.getElementById('dashboardContainer')?.classList.add('loaded');
    
    if (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp.ready) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
    }
    
    // Запуск Firebase и загрузка панели
    if (typeof window.initializeFirebase === 'function') {
        if (window.initializeFirebase()) {
            // loadDashboard будет вызван из DOMContentLoaded в admin_dashboard.html
        } else {
            document.getElementById('telegramAuthInfo').textContent = '❌ Не удалось загрузить конфигурацию Firebase.';
            document.getElementById('saveButton')?.setAttribute('disabled', 'true');
        }
    }
};
