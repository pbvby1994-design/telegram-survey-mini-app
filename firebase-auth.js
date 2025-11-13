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
    
    // Также получаем роли (если они есть) - хотя основным источником прав является Firebase Custom Token
    const adminUrlParam = getUrlParameter('is_admin');
    if (adminUrlParam === 'true') {
        window.isAdmin = true;
    }
    
    if (!configBase64) {
        console.error("Firebase config (firebase_config) not found in URL.");
        // Сообщение об ошибке в index.html будет выведено вызывающей функцией.
        return false;
    }
    
    try {
        const configJson = atob(configBase64);
        window.FIREBASE_CONFIG = JSON.parse(configJson);
    } catch (e) {
        console.error("Failed to decode or parse Firebase config:", e);
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Не удалось декодировать конфигурацию Firebase из URL.');
        return false;
    }
    
    // 2. Инициализация Firebase (v9 compatibility)
    try {
        app = firebase.initializeApp(window.FIREBASE_CONFIG);
        window.db = firebase.firestore(app);
        window.auth = firebase.auth(app);
        console.log("Firebase initialized successfully.");
        return true;
    } catch (e) {
        console.error("Firebase initialization failed:", e);
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', `Не удалось инициализировать Firebase: ${e.message}`);
        return false;
    }
};

// ----------------------------------------------------------------------
// АУТЕНТИФИКАЦИЯ И ПРОВЕРКА СТАТУСА АДМИНА
// ----------------------------------------------------------------------

window.checkAdminStatus = async function() {
    if (!token) {
        console.warn("Custom token not found in URL.");
        document.getElementById('saveButton')?.setAttribute('disabled', 'true');
        
        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ #1: Добавляем ?. для предотвращения TypeError
        document.getElementById('debugAdminStatus')?.textContent = "ОТКАЗ (Нет токена)";
        
        // Если нет токена, мы не можем провести аутентификацию, но это не обязательно ошибка,
        // если пользователь заходит как обычный агитатор.
        return false; 
    }
    
    try {
        // 1. Аутентификация с помощью Custom Token (v8 Syntax)
        const userCredential = await window.auth.signInWithCustomToken(token);
        
        // 2. Получение Claims (проверка флага админа из токена)
        const idTokenResult = await userCredential.user.getIdTokenResult();
        
        // Перезаписываем isAdmin на основе Claims
        if (idTokenResult.claims && idTokenResult.claims.admin) {
             const tokenAdmin = idTokenResult.claims.admin;
             // Сравниваем строго с true или 'true' (так как claim может быть строкой или булевым значением)
             window.isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
        }
        
        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ #2: Добавляем ?. для предотвращения TypeError
        document.getElementById('debugAdminStatus')?.textContent = window.isAdmin ? 'ДА (Токен)' : 'НЕТ (Токен)';
        
        document.getElementById('saveButton')?.removeAttribute('disabled');
        
        // Если мы находимся на index.html и это админ, показываем кнопку админа
        if (window.isAdmin && document.getElementById('adminButton')) {
             document.getElementById('adminButton').style.display = 'flex'; // или 'block'
        }
        
        return true;
    } catch (error) {
        console.error("Firebase Custom Token Auth failed:", error);
        
        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ #3: Добавляем ?. для предотвращения TypeError
        document.getElementById('debugAdminStatus')?.textContent = 'ОШИБКА АУТЕНТИФИКАЦИИ';
        
        window.showAlert('ОШИБКА АУТЕНТИФИКАЦИИ', `Не удалось войти: ${error.message}. Проверьте Custom Token.`);
        document.getElementById('saveButton')?.setAttribute('disabled', 'true');
        
        return false;
    }
};
