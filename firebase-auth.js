// firebase-auth.js (ОКОНЧАТЕЛЬНАЯ ВЕРСИЯ - СИНТАКСИЧЕСКИ ПРАВИЛЬНАЯ И БЕЗОПАСНАЯ)

// --- Глобальные переменные ---
let app = null;
window.db = null;
window.auth = null;
window.userTelegramId = null;
window.userTelegramUsername = null;
window.isAdmin = false; 

let token = null;

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

    if (!configBase64) {
        console.error("Firebase config not found in URL.");
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Конфигурация Firebase не найдена в URL. Проверьте настройки бота.');
        return false;
    }

    try {
        const configJson = atob(configBase64);
        const config = JSON.parse(configJson);
        
        // 2. Инициализация Firebase
        app = firebase.initializeApp(config);
        window.db = firebase.firestore();
        window.auth = firebase.auth();
        
        // Установка времени ожидания для операций
        window.db.settings({
            ignoreUndefinedProperties: true
        });

        console.log("Firebase initialized successfully.");
        return true;
        
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', `Ошибка инициализации Firebase: ${error.message}`);
        return false;
    }
};

// ----------------------------------------------------------------------
// АУТЕНТИФИКАЦИЯ (CUSTOM TOKEN)
// ----------------------------------------------------------------------

window.checkAdminStatus = async function() {
    if (!window.auth) {
        console.error("Firebase Auth not initialized.");
        return false;
    }
    
    const debugAdminStatus = document.getElementById('debugAdminStatus');
    const saveButton = document.getElementById('saveButton');
    const telegramAuthInfo = document.getElementById('telegramAuthInfo');

    if (!token) {
        console.warn("Custom token not found in URL.");
        saveButton?.setAttribute('disabled', 'true');
        debugAdminStatus?.textContent = "ОТКАЗ (Нет токена)";
        telegramAuthInfo.textContent = '❌ Необходим токен аутентификации.';
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
             // ПРИСВАИВАНИЕ (строки 117-120): Используем ОДИН знак "="
             window.isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
        }
        
        debugAdminStatus?.textContent = window.isAdmin ? 'ДА (Токен)' : 'НЕТ (Токен)';
        saveButton?.removeAttribute('disabled');
        telegramAuthInfo.textContent = `✅ Аутентификация успешна. Роль: ${window.isAdmin ? 'Администратор' : 'Агитатор'}`;
        
        // Показ кнопки администратора
        if (window.isAdmin && document.getElementById('adminButton')) {
             document.getElementById('adminButton').style.display = 'flex';
             
             // Для плавной анимации (stagger)
             const adminButton = document.getElementById('adminButton');
             if (adminButton?.classList.contains('stagger-item')) {
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
}

// ----------------------------------------------------------------------
// ВЫХОД ИЗ СИСТЕМЫ
// ----------------------------------------------------------------------

window.signOut = async function() {
    try {
        await window.auth.signOut();
        window.isAdmin = false;
        console.log("User signed out.");
        // Перезагрузка страницы, чтобы вернуться к стартовому экрану
        window.location.reload(); 
    } catch (error) {
        console.error("Error signing out:", error);
        window.showAlert('ОШИБКА ВЫХОДА', `Не удалось выйти из системы: ${error.message}`);
    }
}
