// firebase-auth.js (ОКОНЧАТЕЛЬНАЯ ВЕРСИЯ - СИНТАКСИЧЕСКИ ПРАВИЛЬНАЯ И БЕЗОПАСНАЯ)

// --- Глобальные переменные ---
let app = null;
window.db = null;
window.auth = null;
window.userTelegramId = null;
window.userTelegramUsername = null;
window.isAdmin = false; 

let token = null;

// НОВЫЕ ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ КЛЮЧЕЙ (Установлены здесь)
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

    // 1. Получение Base64-параметра
    const configBase64 = getUrlParameter('config');
    const customToken = getUrlParameter('token'); // Firebase Custom Token
    const isAdminParam = getUrlParameter('is_admin'); 
    const telegramId = getUrlParameter('telegram_id'); 
    const telegramUsername = getUrlParameter('telegram_username'); 
    
    // 0. Проверка загрузки Firebase SDK
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp !== 'function') {
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Firebase SDK не загружен. Проверьте подключение в HTML.');
        return false;
    }

    // Проверка наличия минимальной конфигурации
    if (!configBase64 || !customToken || !telegramId) {
        // Ошибка: нет обязательных параметров.
        // showAlert будет вызвана в index.html
        return false;
    }
    
    let configData;
    try {
        // Декодирование Base64
        const configJsonString = atob(configBase64);
        configData = JSON.parse(configJsonString);
        
        // --- СОХРАНЕНИЕ КЛЮЧЕЙ ИЗ КОНФИГАЦИИ В ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
        if (configData.dadata_token) {
            window.DADATA_API_KEY = configData.dadata_token;
        }
        if (configData.yandex_map_key) {
            window.YANDEX_MAP_KEY = configData.yandex_map_key;
        }
        // ----------------------------------------------------------------

    } catch (error) {
        console.error("Error parsing config:", error);
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Ошибка декодирования или парсинга конфигурации.');
        return false;
    }

    // 2. Инициализация Firebase
    if (!firebase.apps.length) {
        app = firebase.initializeApp(configData.firebaseConfig);
        window.db = app.firestore();
        window.auth = app.auth();
    }
    
    // 3. Сохранение пользовательских данных
    window.userTelegramId = telegramId;
    window.userTelegramUsername = telegramUsername || null;
    
    // 4. Установка статуса администратора (если передан)
    if (isAdminParam) {
        window.isAdmin = (isAdminParam.toLowerCase() === 'true');
    }
    
    // 5. Сохранение Custom Token для дальнейшей аутентификации
    token = customToken;
    
    return true; 
} 

/**
 * Аутентификация пользователя через Firebase Custom Token.
 * Вызывается после initializeFirebase в index.html
 */
window.checkAdminStatus = async function() {
    const telegramAuthInfo = document.getElementById('telegramAuthInfo');
    const saveButton = document.getElementById('saveButton');
    const debugAdminStatus = document.getElementById('debugAdminStatus');
    
    if (!token) {
        // Если token не установлен в initializeFirebase, то произошла ошибка
        telegramAuthInfo.textContent = '❌ Критическая ошибка: отсутствует токен аутентификации.';
        debugAdminStatus?.textContent = 'ОШИБКА ТОКЕНА';
        return false;
    }
    
    try {
        await window.auth.signInWithCustomToken(token);
        
        // Дополнительная проверка роли через claim токена
        const idTokenResult = await window.auth.currentUser.getIdTokenResult(true);
        if (idTokenResult.claims.admin) {
            window.isAdmin = true;
        } 
        
        // Проверка флага из URL, который имеет приоритет в Telegram Mini App
        const isAdminParam = getUrlParameter('is_admin');
        if (isAdminParam) {
            window.isAdmin = (isAdminParam.toLowerCase() === 'true');
        }
        
        debugAdminStatus?.textContent = window.isAdmin ? 'ДА (Токен)' : 'НЕТ (Токен)';
        saveButton?.removeAttribute('disabled');
        telegramAuthInfo.textContent = `✅ Аутентификация успешна. Роль: ${window.isAdmin ? 'Администратор' : 'Агитатор'}`;
        
        // Показ кнопки администратора
        if (window.isAdmin && document.getElementById('adminButton')) {
             document.getElementById('adminButton').style.display = 'flex';
             
             // Для плавной анимации (stagger)
             const adminButton = document.getElementById('adminButton');
             if (adminButton.classList.contains('stagger-item')) {
                 // Временно удаляем opacity=0, чтобы сработала CSS анимация stagger-item
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
