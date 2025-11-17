// firebase-auth.js (ОКОНЧАТЕЛЬНАЯ ВЕРСИЯ - СИНТАКСИЧЕСКИ ПРАВИЛЬНАЯ И БЕЗОПАСНАЯ)

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
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp !== 'function') {
        console.error("Firebase SDK not loaded.");
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Не удалось загрузить Firebase SDK.');
        return false;
    }
    
    // 1. Получение Base64-конфига
    const configBase64 = getUrlParameter('config');
    const tokenParam = getUrlParameter('token');
    
    if (!configBase64) {
        console.error("Configuration (config parameter) not found in URL.");
        return false;
    }

    try {
        // Декодирование Base64
        const configJson = atob(configBase64);
        const config = JSON.parse(configJson);
        
        // Установка токена
        token = tokenParam || config.TELEGRAM_CUSTOM_TOKEN; // Предпочитаем token из URL
        if (!token) {
            console.error("Custom token not found in URL or config.");
            window.showAlert('ОШИБКА', 'Пользовательский токен не найден.');
            return false;
        }

        // Установка ключей API в window
        window.DADATA_API_KEY = config.DADATA_TOKEN || null;
        window.YANDEX_MAP_KEY = config.YMAPS_API_KEY || null;

        // Инициализация Firebase
        app = firebase.initializeApp(config.FIREBASE_CONFIG);
        window.db = firebase.firestore(app);
        window.auth = firebase.auth(app);
        
        // Аутентификация Telegram User
        window.userTelegramId = config.USER_ID;
        window.userTelegramUsername = config.USERNAME;
        
        return true;
        
    } catch (error) {
        console.error("Configuration decoding or parsing failed:", error);
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Неверный формат конфигурации: ' + error.message);
        return false;
    }
}

// ----------------------------------------------------------------------
// АУТЕНТИФИКАЦИЯ И ПРОВЕРКА РОЛИ АДМИНИСТРАТОРА
// ----------------------------------------------------------------------

window.checkAdminStatus = async function() {
    const telegramAuthInfo = document.getElementById('telegramAuthInfo');
    const saveButton = document.getElementById('saveButton');
    const debugAdminStatus = document.getElementById('debugAdminStatus');

    if (!window.auth || !token) {
        telegramAuthInfo.textContent = '❌ Критическая ошибка: Auth/Token отсутствует.';
        return false;
    }

    try {
        // Используем токен для входа в Firebase
        const userCredential = await window.auth.signInWithCustomToken(token);
        const user = userCredential.user;
        
        // Получение ID токена для проверки кастомных клеймов (claims)
        const idTokenResult = await user.getIdTokenResult(true);
        const claims = idTokenResult.claims;
        
        // Проверка claims для роли администратора
        const tokenAdmin = claims.admin;
        if (typeof tokenAdmin !== 'undefined') {
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
        return false;
    }
}
