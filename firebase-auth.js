// firebase-auth.js (СИНТАКСИЧЕСКИ ПРАВИЛЬНАЯ ВЕРСИЯ)

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
// ИНИЦИАЛИЗАЦИЯ
// ----------------------------------------------------------------------

window.initializeFirebase = function() {
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
    
    // 
    const adminUrlParam = getUrlParameter('is_admin');
    if (adminUrlParam === 'true') {
        // 👇 ИСПРАВЛЕНИЕ СТРОКИ 83: Чистое присваивание
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
    if (!token) {
        console.warn("Custom token not found in URL.");
        document.getElementById('saveButton')?.setAttribute('disabled', 'true');
        
        // Добавлен ?.
        document.getElementById('debugAdminStatus')?.textContent = "ОТКАЗ (Нет токена)";
        
        return false; 
    }
    
    try {
        const userCredential = await window.auth.signInWithCustomToken(token);
        const idTokenResult = await userCredential.user.getIdTokenResult();
        
        if (idTokenResult.claims && idTokenResult.claims.admin) {
             const tokenAdmin = idTokenResult.claims.admin;
             window.isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
        }
        
        // Добавлен ?.
        document.getElementById('debugAdminStatus')?.textContent = window.isAdmin ? 'ДА (Токен)' : 'НЕТ (Токен)';
        
        document.getElementById('saveButton')?.removeAttribute('disabled');
        
        if (window.isAdmin && document.getElementById('adminButton')) {
             document.getElementById('adminButton').style.display = 'flex';
             
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
        
        // Добавлен ?.
        document.getElementById('debugAdminStatus')?.textContent = 'ОШИБКА АУТЕНТИФИКАЦИИ';
        
        window.showAlert('ОШИБКА АУТЕНТИФИКАЦИИ', `Не удалось войти: ${error.message}. Проверьте Custom Token.`);
        document.getElementById('saveButton')?.setAttribute('disabled', 'true');
        
        return false;
    }
};
