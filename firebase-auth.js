// firebase-auth.js (ГЛОБАЛЬНАЯ ВЕРСИЯ)

// --- Глобальные переменные (доступны в main.js) ---
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
    
    // 1. Считывание и декодирование конфигурации Firebase
    const configBase64 = getUrlParameter('firebase_config');
    token = getUrlParameter('token'); 
    
    // Получение user_id и admin_status
    const url_user_id = getUrlParameter('user_id');
    const url_is_admin = getUrlParameter('is_admin'); 
    
    if (url_user_id) {
        window.userTelegramId = url_user_id;
        document.getElementById('debugUserId').textContent = window.userTelegramId;
    } else {
        document.getElementById('debugUserId').textContent = 'НЕ АВТОРИЗОВАН';
        return false; // Прерываем инициализацию, если нет ID
    }

    if (url_is_admin) {
        // Устанавливаем статус админа из URL (этот статус может быть переопределен токеном)
        window.isAdmin = (url_is_admin.toLowerCase() === 'true');
    }

    if (configBase64) {
        try {
            const decodedConfig = JSON.parse(atob(configBase64));
            
            // 2. Инициализация Firebase (v8 Syntax)
            app = firebase.initializeApp(decodedConfig);
            window.db = firebase.firestore(app);
            window.auth = firebase.auth(app);
            
            return true;
        } catch (e) {
            console.error("Firebase config error:", e);
            window.showAlert('Ошибка Конфигурации', 'Не удалось декодировать Firebase config.');
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
    
    // 1. Проверка наличия токена
    if (!token) {
        console.warn("Custom token not found in URL.");
        document.getElementById('saveButton').disabled = true;
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
             // Снова проверяем, что 'true' (string) -> true (boolean)
             window.isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
        }
        
        document.getElementById('debugAdminStatus').textContent = window.isAdmin ? 'ДА (Токен)' : 'НЕТ (Токен)';
        document.getElementById('saveButton').disabled = false;
        
        return true;
    } catch (error) {
        console.error("Firebase Custom Token Auth failed:", error);
        window.showAlert('ОШИБКА АУТЕНТИФИКАЦИИ', `Не удалось войти: ${error.message}. Проверьте Custom Token.`);
        document.getElementById('saveButton').disabled = true;
        document.getElementById('debugAdminStatus').textContent = "ОШИБКА АВТОРИЗАЦИИ";
        return false;
    }
}
