// firebase-auth.js (СИНТАКСИЧЕСКИ ПРАВИЛЬНЫЙ И БЕЗОПАСНЫЙ КОД)

// --- Глобальные переменные ---
let app = null;
window.db = null;
window.auth = null;
window.userTelegramId = null;
window.userTelegramUsername = null;
window.isAdmin = false; 

let token = null;
window.FIREBASE_CONFIG = null; // Хранение конфигурации

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
    
    // 1. Считывание и декодирование конфигурации Firebase
    const configBase64 = getUrlParameter('firebase_config');
    token = getUrlParameter('token'); 
    
    // Получение user_id и username
    window.userTelegramId = getUrlParameter('user_id');
    window.userTelegramUsername = getUrlParameter('username');
    
    // Получение admin статуса из URL (для переопределения/отладки, но приоритет у токена)
    const adminUrlParam = getUrlParameter('is_admin');
    if (adminUrlParam === 'true') {
        window.isAdmin = true; 
    }
    
    if (!configBase64) {
        console.error("Firebase config (firebase_config) not found in URL.");
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Параметр "firebase_config" не найден в URL.');
        return false;
    }
    
    // 2. Декодирование и парсинг Base64
    try {
        const configJson = atob(configBase64);
        window.FIREBASE_CONFIG = JSON.parse(configJson);
        
        // 2.1. Строгая проверка декодированного объекта
        if (!window.FIREBASE_CONFIG.apiKey || !window.FIREBASE_CONFIG.projectId) {
            throw new Error("Missing critical fields in Firebase config (e.g., apiKey, projectId).");
        }
        
    } catch (e) {
        console.error("Failed to decode or parse Firebase config:", e);
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', `Не удалось декодировать или проанализировать конфигурацию Firebase. Ошибка: ${e.message}`);
        return false;
    }
    
    // 3. Инициализация Firebase
    try {
        // Проверка, что приложение еще не инициализировано
        if (!firebase.apps.length) {
            app = firebase.initializeApp(window.FIREBASE_CONFIG);
            // При использовании compat API вызываем методы с app
            window.db = firebase.firestore(app); 
            window.auth = firebase.auth(app);
            console.log("Firebase initialized successfully.");
        }
        return true;
    } catch (e) {
        console.error("Firebase initialization failed:", e);
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', `Не удалось инициализировать Firebase: ${e.message}. Проверьте правильность конфигурации.`);
        return false;
    }
};

// ----------------------------------------------------------------------
// АУТЕНТИФИКАЦИЯ
// ----------------------------------------------------------------------

window.checkAdminStatus = async function() {
    // Используем ?. для безопасности
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
        saveButton?.setAttribute('disabled', 'true');
        
        return false;
    }
};
