// firebase-auth.js (ИСПРАВЛЕННАЯ ВЕРСИЯ)

// --- Глобальные переменные (доступны в main.js через window.) ---
let app = null;
window.db = null;
window.auth = null;
window.userTelegramId = null;
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
    // Проверка наличия глобального объекта Firebase
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Firebase SDK не загружен. Проверьте подключение CDN в HTML.');
        return false;
    }
    
    // 1. Считывание конфигурации Firebase - БЕРЕМ ИЗ window, а не из URL
    if (typeof window.FIREBASE_CONFIG === 'undefined' || !window.FIREBASE_CONFIG.apiKey) {
         window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Конфигурация Firebase не загружена. Проверьте config.js.');
         return false;
    }
    
    token = getUrlParameter('token'); 
    window.userTelegramId = getUrlParameter('user_id'); // Получение user_id

    // 2. Инициализация Firebase (v8 Syntax)
    if (!app) {
        app = firebase.initializeApp(window.FIREBASE_CONFIG); // <-- ИСПРАВЛЕНО
        window.db = app.firestore();
        window.auth = app.auth();
    }
    
    return true;
}

// ----------------------------------------------------------------------
// АУТЕНТИФИКАЦИЯ (Использует токен из URL)
// ----------------------------------------------------------------------

window.authenticateUser = async function() {
    // 1. Проверка наличия токена
    if (!token) {
        console.warn("Custom token not found in URL.");
        // Предполагаем, что saveButton существует только в admin_dashboard.html
        const saveButton = document.getElementById('saveButton');
        if(saveButton) saveButton.disabled = true;
        // ... (обновление статуса)
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
             window.isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
        }
        
        // Обновление статусов и кнопок
        const saveButton = document.getElementById('saveButton');
        const debugStatus = document.getElementById('debugAdminStatus');
        
        if (debugStatus) debugStatus.textContent = window.isAdmin ? 'ДА (Токен)' : 'НЕТ (Токен)';
        if (saveButton) saveButton.disabled = false;
        
        return true;
    } catch (error) {
        console.error("Firebase Custom Token Auth failed:", error);
        window.showAlert('ОШИБКА АУТЕНТИФИКАЦИИ', `Не удалось войти: ${error.message}. Проверьте Custom Token.`);
        const saveButton = document.getElementById('saveButton');
        if(saveButton) saveButton.disabled = true;
        
        return false;
    }
}

// ----------------------------------------------------------------------
// ПРОВЕРКА СТАТУСА АДМИНА (Для index.html)
// ----------------------------------------------------------------------
window.checkAdminStatus = async function() {
    const isAuthenticated = await window.authenticateUser();
    
    document.getElementById('telegramAuthInfo').textContent = isAuthenticated 
        ? `✅ Успешная аутентификация. ID: ${window.userTelegramId}. ${window.isAdmin ? 'Администратор.' : 'Пользователь.'}`
        : '❌ Аутентификация не удалась.';
        
    document.getElementById('adminButton').disabled = !window.isAdmin; 
    document.getElementById('userButton').disabled = false;
    
    return window.isAdmin;
}
