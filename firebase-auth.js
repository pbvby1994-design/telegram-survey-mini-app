// firebase-auth.js (ГЛОБАЛЬНАЯ ВЕРСИЯ - БЕЗ ИМПОРТОВ И ЭКСПОРТОВ)

// --- Глобальные переменные (доступны в main.js через window.) ---
let app = null;
window.db = null;
window.auth = null;
window.userTelegramId = null;
window.userTelegramUsername = null;
window.isAdmin = false;

let token = null;

// Функция для получения параметра из URL
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// ----------------------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ И ПОЛУЧЕНИЕ ПАРАМЕТРОВ ИЗ URL
// ----------------------------------------------------------------------

window.initializeFirebase = function() {
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
    
    if (!configBase64) {
        console.error("Firebase config not found in URL.");
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Конфигурация Firebase не найдена в URL. Запустите приложение через Telegram-бота.');
        return false;
    }

    try {
        const configJson = atob(configBase64);
        const FIREBASE_CONFIG = JSON.parse(configJson);
        
        // Инициализация Firebase (если не инициализировано)
        if (!app) {
            app = firebase.initializeApp(FIREBASE_CONFIG);
            window.auth = app.auth();
            window.db = app.firestore();
        }
        
        return true;
    } catch (e) {
        console.error("Failed to decode or parse Firebase config:", e);
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Неверный формат конфигурации Firebase.');
        return false;
    }
}

// ----------------------------------------------------------------------
// АУТЕНТИФИКАЦИЯ И ПРОВЕРКА РОЛИ
// ----------------------------------------------------------------------

window.authenticateUser = async function() {
    
    if (!token) {
        console.warn("Custom token not found in URL.");
        document.getElementById('saveButton')?.setAttribute('disabled', 'true');
        document.getElementById('debugAdminStatus').textContent = "ОТКАЗ (Нет токена)";
        return false;
    }
    
    try {
        // 2. Аутентификация с помощью Custom Token (v8 Syntax)
        const userCredential = await window.auth.signInWithCustomToken(token);
        
        // 3. Получение Claims (проверка флага админа из токена)
        const idTokenResult = await userCredential.user.getIdTokenResult();
        
        // Перезаписываем isAdmin на основе Claims
        if (idTokenResult.claims && idTokenResult.claims.admin) {
             const tokenAdmin = idTokenResult.claims.admin;
             // Сравниваем строго с true или 'true'
             window.isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
        }
        
        document.getElementById('debugAdminStatus').textContent = window.isAdmin ? 'ДА (Токен)' : 'НЕТ (Токен)';
        document.getElementById('saveButton')?.removeAttribute('disabled');
        
        return true;
    } catch (error) {
        console.error("Firebase Custom Token Auth failed:", error);
        window.showAlert('ОШИБКА АУТЕНТИФИКАЦИИ', `Не удалось войти: ${error.message}. Проверьте Custom Token.`);
        document.getElementById('saveButton')?.setAttribute('disabled', 'true');
        return false;
    }
}
