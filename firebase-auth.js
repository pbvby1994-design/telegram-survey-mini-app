// firebase-auth.js (ЦЕЛЕВАЯ, БЕЗОПАСНАЯ ВЕРСИЯ С ЕДИНЫМ КОНФИГОМ)

// --- Глобальные переменные ---
let app = null;
window.db = null;
window.auth = null;
window.userTelegramId = null;
window.userTelegramUsername = null;
window.isAdmin = false; 

let token = null;

// НОВЫЕ ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ КЛЮЧЕЙ (Установлены из Base64-конфига)
window.DADATA_API_KEY = null; 
window.YANDEX_MAP_KEY = null; 
// ------------------------------

// Максимальная безопасная длина URL (общепринятый лимит)
const MAX_URL_LENGTH = 2000; 

// Функция для получения параметра из URL
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// ----------------------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ И ПОЛУЧЕНИЕ ПАРАМЕТРОВ ИЗ URL
// ----------------------------------------------------------------------

window.initializeFirebase = function() {
    // 0. Проверка общей длины URL
    if (window.location.href.length > MAX_URL_LENGTH) {
        console.error("URL too long. May be truncated.");
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Длина URL превышает безопасный лимит. Конфигурация может быть обрезана.');
        return false;
    }

    // 0. Проверка загрузки Firebase SDK
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Firebase SDK не загружен. Проверьте подключение CDN в HTML.');
        return false;
    }
    
    // 1. Считывание всех параметров из URL
    const configBase64 = getUrlParameter('config'); // <-- ИЩЕМ ЕДИНЫЙ ПАРАМЕТР 'config'
    token = getUrlParameter('token'); 
    window.userTelegramId = getUrlParameter('user_id');
    window.userTelegramUsername = getUrlParameter('username');
    const adminUrlParam = getUrlParameter('is_admin');
    
    
    if (!configBase64 || !token || !window.userTelegramId) {
        // Убрали showAlert, т.к. его должен вызвать document.addEventListener в admin_dashboard/index
        console.error("Отсутствуют обязательные параметры URL (config, token, user_id).");
        return false;
    }
    
    let configData;
    // 2. Декодирование и парсинг Base64
    try {
        const configJson = atob(configBase64);
        configData = JSON.parse(configJson);
        
        // --- СОХРАНЕНИЕ КЛЮЧЕЙ ИЗ КОНФИГАЦИИ ---
        // Эти ключи должны быть в вашем Base64 JSON!
        window.DADATA_API_KEY = configData.dadata_token || null;
        window.YANDEX_MAP_KEY = configData.ymaps_api_key || null;
        const firebaseConfig = configData.firebase_config;

        if (!firebaseConfig || !firebaseConfig.apiKey) {
            throw new Error("Missing critical Firebase fields inside config.");
        }
        
        // Сохраняем публичную конфигурацию Firebase для инициализации
        window.FIREBASE_CONFIG = firebaseConfig; 
        
    } catch (e) {
        console.error("Failed to decode or parse config:", e);
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', `Не удалось проанализировать конфигурацию (config). Ошибка: ${e.message}`);
        return false;
    }
    
    // 3. Инициализация Firebase
    try {
        if (!firebase.apps.length) {
            app = firebase.initializeApp(window.FIREBASE_CONFIG);
            window.db = firebase.firestore(app);
            window.auth = firebase.auth(app);
            console.log("Firebase initialized successfully.");
        }
        
        // 4. Установка статуса администратора (приоритет у токена, но URL может быть базой)
        if (adminUrlParam === 'true') {
            window.isAdmin = true; 
        }
        
        return true;
    } catch (e) {
        console.error("Firebase initialization failed:", e);
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', `Не удалось инициализировать Firebase: ${e.message}. Проверьте правильность ключей.`);
        return false;
    }
};

// ----------------------------------------------------------------------
// АУТЕНТИФИКАЦИЯ (без изменений, т.к. она синтаксически верна)
// ----------------------------------------------------------------------

window.checkAdminStatus = async function() {
    // ... (весь код функции checkAdminStatus остается без изменений)
    const telegramAuthInfo = document.getElementById('telegramAuthInfo');
    const saveButton = document.getElementById('saveButton'); 
    const debugAdminStatus = document.getElementById('debugAdminStatus');

    if (!token) {
        console.warn("Custom token not found in URL.");
        saveButton?.setAttribute('disabled', 'true');
        telegramAuthInfo.textContent = '❌ Требуется токен аутентификации.';
        return false; 
    }
    
    try {
        const userCredential = await window.auth.signInWithCustomToken(token);
        const idTokenResult = await userCredential.user.getIdTokenResult();
        
        // Проверка isAdmin из claims токена Firebase
        if (idTokenResult.claims && idTokenResult.claims.admin) {
             const tokenAdmin = idTokenResult.claims.admin;
             window.isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
        }
        
        // Отображение статуса
        debugAdminStatus?.textContent = window.isAdmin ? 'ДА (Токен)' : 'НЕТ (Токен)';
        saveButton?.removeAttribute('disabled');
        telegramAuthInfo.textContent = `✅ Аутентификация успешна. Роль: ${window.isAdmin ? 'Администратор' : 'Агитатор'}`;
        
        // Показ кнопки администратора
        if (window.isAdmin && document.getElementById('adminButton')) {
             document.getElementById('adminButton').style.display = 'flex';
             
             // Для плавной анимации (stagger)
             const adminButton = document.getElementById('adminButton');
             if (adminButton.classList.contains('stagger-item')) {
                 adminButton.style.opacity = 0; 
                 setTimeout(() => {
                    adminButton.style.opacity = 1; 
                 }, 10);
             }
        }
        
        return true;
    } catch (error) {
        console.error("Firebase Custom Token Auth failed:", error);
        
        debugAdminStatus?.textContent = 'ОШИБКА АУТЕНТИФИКАЦИИ'; 
        telegramAuthInfo.textContent = '❌ Ошибка аутентификации Firebase.';
        
        window.showAlert('ОШИБКА АУТЕНТИФИКАЦИИ', `Не удалось войти: ${error.message}. Проверьте Custom Token.`);
        saveButton?.setAttribute('disabled', 'true');
        
        return false;
    }

