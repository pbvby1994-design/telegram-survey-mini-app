// firebase-auth.js (ИСПРАВЛЕННАЯ ВЕРСИЯ)

// --- Глобальные переменные ---
let app = null;
window.db = null;
window.auth = null;
window.userTelegramId = null;
window.isAdmin = false;
let customAuthToken = null; // Переименовано, чтобы избежать конфликта с token в getUrlParameter

// Функция для получения параметра из URL
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// ----------------------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ
// ----------------------------------------------------------------------

window.initializeFirebase = function() {
    // 1. Проверка наличия SDK
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Firebase SDK не загружен. Проверьте подключение CDN в HTML.');
        return false;
    }
    
    // 2. Считывание конфигурации из config.js
    if (typeof window.FIREBASE_CONFIG === 'undefined' || !window.FIREBASE_CONFIG.apiKey) {
         window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Конфигурация Firebase не загружена. Проверьте config.js.');
         return false;
    }
    
    // 3. Получение параметров из URL
    customAuthToken = getUrlParameter('token'); 
    window.userTelegramId = getUrlParameter('user_id'); 

    // 4. Инициализация Firebase
    if (!app) {
        app = firebase.initializeApp(window.FIREBASE_CONFIG);
        window.db = app.firestore();
        window.auth = app.auth();
    }
    
    return true;
}

// ----------------------------------------------------------------------
// АУТЕНТИФИКАЦИЯ
// ----------------------------------------------------------------------

window.authenticateUser = async function() {
    // 1. Проверка наличия токена
    if (!customAuthToken) {
        console.warn("Custom token not found in URL. Admin features disabled.");
        const debugStatus = document.getElementById('debugAdminStatus');
        if (debugStatus) debugStatus.textContent = "ОТКАЗ (Нет токена)";
        return false;
    }
    
    try {
        // 2. Аутентификация
        const userCredential = await window.auth.signInWithCustomToken(customAuthToken);
        
        // 3. Получение Claims (проверка флага админа из токена)
        const idTokenResult = await userCredential.user.getIdTokenResult();
        
        if (idTokenResult.claims && idTokenResult.claims.admin) {
             const tokenAdmin = idTokenResult.claims.admin;
             // Приводим значение к булеву типу, учитывая возможную передачу строки 'true'
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
    if (!window.userTelegramId) {
         document.getElementById('telegramAuthInfo').textContent = '❌ ID пользователя Telegram не найден в URL.';
         return false;
    }
    
    const isAuthenticated = await window.authenticateUser();
    
    document.getElementById('telegramAuthInfo').textContent = isAuthenticated 
        ? `✅ Успешная аутентификация. ID: ${window.userTelegramId}. ${window.isAdmin ? 'Администратор.' : 'Пользователь.'}`
        : '❌ Аутентификация не удалась. Сохранение отчетов недоступно.';
        
    const adminButton = document.getElementById('adminButton');
    if (adminButton) adminButton.disabled = !window.isAdmin; 
    
    const userButton = document.getElementById('userButton');
    if (userButton) userButton.disabled = false; // Пользовательская кнопка всегда активна
    
    return window.isAdmin;
}
