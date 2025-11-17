// firebase-auth.js (ОКОНЧАТЕЛЬНАЯ ВЕРСИЯ - СИНТАКСИЧЕСКИ ПРАВИЛЬНАЯ)

// --- Глобальные переменные ---
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
    // Эта проверка срабатывает, если CDN не загрузился
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Firebase SDK не загружен.');
        return false;
    }
    
    // 1. Считывание и декодирование конфигурации Firebase
    const configBase64 = getUrlParameter('firebase_config');
    token = getUrlParameter('token'); 
    
    // Получение user_id и username
    window.userTelegramId = getUrlParameter('user_id');
    window.userTelegramUsername = getUrlParameter('username');
    
    // Около строки 83: Проверка параметра is_admin
    const adminUrlParam = getUrlParameter('is_admin');
    if (adminUrlParam === 'true') {
        // 👇 ВАЖНО: Только оператор присваивания '='
        window.isAdmin = true; 
    }
    
    if (!configBase64) {
        console.error("Firebase config (firebase_config) not found in URL.");
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
    
    // 2. Инициализация Firebase
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
// АУТЕНТИФИКАЦИЯ
// ----------------------------------------------------------------------

window.checkAdminStatus = async function() {
    // В index.html нет этих элементов, используем ?.
    const telegramAuthInfo = document.getElementById('telegramAuthInfo');
    const saveButton = document.getElementById('saveButton'); 
    const debugAdminStatus = document.getElementById('debugAdminStatus');

    if (!token) {
        console.warn("Custom token not found in URL.");
        saveButton?.setAttribute('disabled', 'true');
        debugAdminStatus?.textContent = "ОТКАЗ (Нет токена)";
        telegramAuthInfo.textContent = '❌ Требуется токен аутентификации.';
        return false; 
    }
    
    try {
        const userCredential = await window.auth.signInWithCustomToken(token);
        const idTokenResult = await userCredential.user.getIdTokenResult();
        
        if (idTokenResult.claims && idTokenResult.claims.admin) {
             const tokenAdmin = idTokenResult.claims.admin;
             window.isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
        }
        
        debugAdminStatus?.textContent = window.isAdmin ? 'ДА (Токен)' : 'НЕТ (Токен)';
        saveButton?.removeAttribute('disabled');
        telegramAuthInfo.textContent = `✅ Аутентификация успешна. Роль: ${window.isAdmin ? 'Администратор' : 'Агитатор'}`;
        
        if (window.isAdmin && document.getElementById('adminButton')) {
             document.getElementById('adminButton').style.display = 'flex';
             
             // Для плавной анимации
             if (document.getElementById('adminButton').classList.contains('stagger-item')) {
                 document.getElementById('adminButton').style.opacity = 0; 
                 setTimeout(() => {
                    document.getElementById('adminButton').style.opacity = 1; 
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
