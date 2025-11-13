// firebase-auth.js (ОБНОВЛЕННАЯ ВЕРСИЯ)

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
    
    // ПРИОРИТЕТ 1: Использование FIREBASE_CONFIG из config.js
    if (typeof window.FIREBASE_CONFIG !== 'undefined') {
        app = firebase.initializeApp(window.FIREBASE_CONFIG);
    } else {
        // ПРИОРИТЕТ 2: (Запасной вариант) Считывание и декодирование конфигурации Firebase из URL
        const configBase64 = getUrlParameter('firebase_config');
        if (configBase64) {
             try {
                const decodedConfig = atob(configBase64);
                window.FIREBASE_CONFIG = JSON.parse(decodedConfig);
                app = firebase.initializeApp(window.FIREBASE_CONFIG);
            } catch (e) {
                 window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', `Ошибка декодирования Firebase Config: ${e.message}`);
                 return false;
            }
        } else {
            console.warn("Firebase config not found in URL or config.js.");
            window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Конфигурация Firebase не найдена. Приложение не может запуститься.');
            return false;
        }
    }
    
    // Инициализация сервисов
    window.db = firebase.firestore();
    window.auth = firebase.auth();
    
    // Получение токена и ID
    token = getUrlParameter('token'); 
    const url_user_id = getUrlParameter('user_id');

    if (url_user_id) {
         window.userTelegramId = url_user_id;
    } else if (window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
         window.userTelegramId = String(window.Telegram.WebApp.initDataUnsafe.user.id);
    }
    
    return true;
}

// ----------------------------------------------------------------------
// АУТЕНТИФИКАЦИЯ (CUSTOM TOKEN)
// ----------------------------------------------------------------------

window.authenticateUser = async function() {
    // 1. Проверка токена
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
             window.isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
        }
        
        document.getElementById('debugAdminStatus').textContent = window.isAdmin ? 'ДА (Токен)' : 'НЕТ (Токен)';
        document.getElementById('saveButton').disabled = false;
        
        return true;
    } catch (error) {
        console.error("Firebase Custom Token Auth failed:", error);
        window.showAlert('ОШИБКА АУТЕНТИФИКАЦИИ', `Не удалось войти: ${error.message}. Проверьте Custom Token.`);
        document.getElementById('saveButton').disabled = true;
        
        return false;
    }
}
