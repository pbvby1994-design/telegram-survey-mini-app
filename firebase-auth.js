// firebase-auth.js (ОБНОВЛЕНИЕ: Переход на Firebase v9 Compat SDK)

// --- Глобальные переменные (v9 Compat API) ---
window.app = null;
window.db = null;
window.auth = null;

window.userTelegramId = null;
window.isAdmin = false;
window.dadataToken = null; // Для более безопасной передачи

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
    // 1. Проверка наличия Telegram WebApp
    if (typeof Telegram === 'undefined' || typeof Telegram.WebApp === 'undefined') {
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Отсутствует Telegram WebApp SDK.');
        return false;
    }
    
    // Проверка наличия глобального объекта Firebase v9 Compat
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Firebase SDK v9 не загружен. Проверьте подключение CDN в HTML.');
        return false;
    }
    
    // 2. Считывание и декодирование конфигурации Firebase и Dadata
    const configBase64 = getUrlParameter('firebase_config');
    token = getUrlParameter('token'); 
    window.dadataToken = getUrlParameter('dadata_token'); // !!! БЕЗОПАСНАЯ ПЕРЕДАЧА DADATA KEY !!!
    
    // Получение user_id и admin_status
    const url_user_id = getUrlParameter('user_id');
    const url_is_admin = getUrlParameter('is_admin'); 
    
    if (url_user_id) {
        window.userTelegramId = url_user_id;
        document.getElementById('debugUserId').textContent = window.userTelegramId;
    } else {
        document.getElementById('debugUserId').textContent = 'НЕ АВТОРИЗОВАН';
        window.showAlert('Ошибка', 'Отсутствует Telegram ID пользователя.');
        return false;
    }
    
    if (!window.dadataToken) {
        console.error("Dadata Token отсутствует. Поиск адресов не будет работать.");
    }

    if (url_is_admin) {
        // Устанавливаем статус админа из URL (будет переопределен токеном)
        window.isAdmin = (url_is_admin.toLowerCase() === 'true');
    }

    if (configBase64) {
        try {
            const decodedConfig = JSON.parse(atob(configBase64));
            
            // 3. Инициализация Firebase (v9 Compat Syntax)
            window.app = firebase.initializeApp(decodedConfig);
            window.db = firebase.firestore(window.app); 
            window.auth = firebase.auth(window.app);     
            
            return true;
        } catch (e) {
            console.error("Firebase config error:", e);
            window.showAlert('Ошибка Конфигурации', `Не удалось декодировать Firebase config: ${e.message}.`);
            return false;
        }
    } else {
        window.showAlert('Ошибка Конфигурации', 'Параметр firebase_config отсутствует в URL.');
        return false;
    }
}

// ----------------------------------------------------------------------
// АУТЕНТИФИКАЦИЯ С ПОМОЩЬЮ CUSTOM TOKEN
// ----------------------------------------------------------------------

window.authenticateUser = async function() {
    if (!window.auth) return false;
    
    if (!token) {
        console.warn("Custom token not found in URL. Operating as unauthenticated user.");
        document.getElementById('debugAdminStatus').textContent = "ОТКАЗ (Нет токена)";
        return false;
    }
    
    try {
        // 1. Аутентификация (v9 Compat Syntax)
        const userCredential = await window.auth.signInWithCustomToken(token);
        
        // 2. Получение Claims (проверка флага админа из токена)
        const idTokenResult = await userCredential.user.getIdTokenResult();
        
        // Перезаписываем isAdmin на основе Claims
        if (idTokenResult.claims && idTokenResult.claims.admin) {
             const tokenAdmin = idTokenResult.claims.admin;
             window.isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
        }
        
        document.getElementById('debugAdminStatus').textContent = window.isAdmin ? 'ДА (Токен)' : 'НЕТ (Токен)';
        
        return true;
    } catch (error) {
        console.error("Firebase Auth failed:", error);
        window.showAlert('ОШИБКА АУТЕНТИФИКАЦИИ', `Не удалось войти: ${error.message}.`);
        document.getElementById('debugAdminStatus').textContent = "ОШИБКА АВТОРИЗАЦИИ";
        return false;
    }
}
