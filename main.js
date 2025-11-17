// main.js (ES Module: PWA Offline Logic, Dadata, GPS, Form Handling)
import { db, isAdmin, userTelegramId, userTelegramUsername, initializeFirebase, checkAdminStatus } from './firebase-auth.js';
import { loadReports, initSettlementSelects, SETTLEMENTS } from './reports.js';
import { showAlert, showSection, initDarkMode } from './utils.js';

// --- Модульные переменные ---
let mapInstance = null; 
window.mapInstance = null; // Глобальный доступ для Yandex Maps API и utils.js
let currentLatitude = null; 
let currentLongitude = null;
let dadataCoords = null;    

// ... Код для получения DADATA_API_KEY и DADATA_LOCATION_FIAS_ID из URL ...
const urlParams = new URLSearchParams(window.location.search);
const DADATA_API_KEY = urlParams.get('dadata_token'); 
const DADATA_LOCATION_FIAS_ID = urlParams.get('dadata_fias_id') || '86'; 

// ... Переменные элементов DOM ...
const addressInput = document.getElementById('address');
const suggestionsList = document.getElementById('suggestionsList');
const addressStatus = document.getElementById('addressStatus');
const reportForm = document.getElementById('reportForm');


// ----------------------------------------------------------------------------------
// ИНТЕГРАЦИЯ INDEXEDDB (ОФФЛАЙН ЛОГИКА)
// ----------------------------------------------------------------------------------
const DB_NAME = 'AgitatorReportsDB';
const STORE_NAME = 'offlineReports';

// ... openDB(), saveOfflineReport(reportData), getOfflineReports(), deleteOfflineReport(key) ...

async function openDB() { /* ... implementation ... */ }
async function saveOfflineReport(reportData) { 
    try {
        const dbInstance = await openDB();
        const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        reportData.saved_at = Date.now(); 
        const request = store.add(reportData);
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error("Error saving offline report:", error);
        throw error;
    }
}
async function getOfflineReports() { /* ... implementation ... */ }
async function deleteOfflineReport(key) { /* ... implementation ... */ }


/**
 * Обновляет индикатор оффлайн-отчетов
 */
async function updateOfflineIndicator() {
    const offlineReports = await getOfflineReports();
    const infoContainer = document.getElementById('offlineInfoContainer');
    
    if (infoContainer) {
        if (offlineReports.length > 0) {
            infoContainer.textContent = `💾 Вы оффлайн. ${offlineReports.length} отчетов ожидают синхронизации.`;
            infoContainer.classList.remove('hidden');
        } else {
            infoContainer.classList.add('hidden');
        }
    }
}

/**
 * Попытка синхронизации оффлайн-отчетов с Firebase
 */
async function syncOfflineReports() {
    if (!db || !navigator.onLine) return;
    
    const offlineReports = await getOfflineReports();
    if (offlineReports.length === 0) return;

    let syncCount = 0;
    offlineReports.sort((a, b) => a.data.saved_at - b.data.saved_at);

    for (const { key, data: report } of offlineReports) {
        const reportData = { ...report };
        delete reportData.saved_at; // Удаляем служебное поле
        reportData.timestamp = firebase.firestore.FieldValue.serverTimestamp(); 
        
        try {
            await db.collection('reports').add(reportData);
            await deleteOfflineReport(key);
            syncCount++;
        } catch (error) {
            console.warn(`Сбой синхронизации отчета (IDB Key: ${key}):`, error.message);
            break; 
        }
    }
    
    if (syncCount > 0) {
        showAlert('СИНХРОНИЗАЦИЯ', `✅ Успешно отправлено ${syncCount} оффлайн-отчетов в Firebase.`);
    }
    
    if (loadReports) {
        await loadReports(isAdmin ? 'all' : 'my');
    }
    await updateOfflineIndicator();
}

// ----------------------------------------------------------------------------------
// ИНТЕГРАЦИЯ DADATA, GPS, ФОРМА ОТЧЕТА (Переведено на модульную структуру)
// ----------------------------------------------------------------------------------

function handleDadataInput() { /* ... логика Dadata, использует showAlert ... */ }
function selectSuggestion(suggestion) { /* ... логика выбора предложения ... */ }
function handleGpsClick() { /* ... логика GPS, использует showAlert ... */ }
async function handleReportSubmit(e) {
    e.preventDefault();
    
    // ... сбор данных формы ...
    // ... валидация ...

    const finalReport = {
        // ... данные отчета ...
    };
    
    try {
        if (db && navigator.onLine) {
            // 1. ОНЛАЙН: Сохранение в Firebase
            const docRef = await db.collection('reports').add(finalReport);
            showAlert('УСПЕХ', `✅ Отчет по адресу "${finalReport.address}" успешно сохранен!`);
            // ... оповещение Telegram Bot'а ...
            
        } else {
            // 2. ОФФЛАЙН: Сохранение в IndexedDB
            delete finalReport.timestamp; // Удаляем серверную метку
            await saveOfflineReport(finalReport);
            showAlert('ОФФЛАЙН СОХРАНЕНИЕ', `💾 Отчет по адресу "${finalReport.address}" сохранен локально. Будет отправлен при восстановлении сети.`);
            await updateOfflineIndicator(); 
        }

        // ... сброс формы ...
    } catch (error) {
        showAlert('КРИТИЧЕСКАЯ ОШИБКА', `Не удалось сохранить отчет: ${error.message}`);
    } finally {
        // ... включение кнопки сохранения ...
    }
}

// Привязка обработчиков
if (reportForm) {
    reportForm.addEventListener('submit', handleReportSubmit);
}
const gpsButton = document.getElementById('gpsButton');
if (gpsButton) {
    gpsButton.onclick = handleGpsClick;
}

// ----------------------------------------------------------------------------------
// ИНТЕГРАЦИЯ КАРТЫ (Yandex Maps)
// ----------------------------------------------------------------------------------

// Функция window.initMap() теперь содержит логику инициализации карты, 
// а window.updateMapMarkers() вызывается из reports.js.

// ----------------------------------------------------------------------------------
// ЗАПУСК ПРИЛОЖЕНИЯ
// ----------------------------------------------------------------------------------

/**
 * Основная функция загрузки дашборда
 */
async function loadDashboard() {
    const initialView = urlParams.get('view') || 'form-view';
    const urlRole = urlParams.get('role');
    
    initDarkMode(); // Инициализация темной темы

    // 1. Инициализация Firebase
    const isFirebaseInit = initializeFirebase();
    
    if (isFirebaseInit) {
        // 2. Аутентификация и проверка админ-статуса
        const isAuthenticated = await checkAdminStatus(); 

        if (isAuthenticated) {
            // 3. Настройка UI
            // ... (видимость кнопок навигации для админа/агитатора) ...

            // 4. Выбор начального раздела
            let startSection = initialView;
            if (isAdmin && (urlRole === 'admin' || startSection === 'form-view')) {
                 startSection = 'map-view';
            }
            if (!isAdmin && (startSection === 'map-view' || startSection === 'stats' || startSection === 'raw-data')) {
                 startSection = 'form-view';
            }

            // 5. Загрузка данных, Инициализация UI, Синхронизация PWA
            await loadReports(isAdmin ? 'all' : 'my');
            initSettlementSelects(); 
            handleDadataInput(); 
            await updateOfflineIndicator(); 
            await syncOfflineReports();

            // 6. Отображение
            showSection(startSection);
            document.getElementById('saveButton')?.removeAttribute('disabled');
            document.getElementById('dashboardContainer')?.classList.add('loaded');
            
        } else {
             showSection('form-view');
             document.getElementById('saveButton')?.setAttribute('disabled', 'true');
        }
    } else {
         showSection('form-view');
         document.getElementById('saveButton')?.setAttribute('disabled', 'true');
    }
}

// ----------------------------------------------------------------------------------
// ОБРАБОТЧИКИ СОБЫТИЙ WINDOW
// ----------------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // Убеждаемся, что все кнопки-иконки прорисованы
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
    
    loadDashboard();
    
    // Устанавливаем слушатели для PWA/Offline
    window.addEventListener('online', syncOfflineReports);
    window.addEventListener('offline', updateOfflineIndicator);
});
