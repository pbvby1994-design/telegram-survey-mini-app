// firebase-auth.js (ОКОНЧАТЕЛЬНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ - СИНТАКСИЧЕСКИ ПРАВИЛЬНАЯ)

// --- Глобальные переменные ---
let app = null;
window.db = null;
window.auth = null;
window.userTelegramId = null;
window.userTelegramUsername = null;
window.isAdmin = false; 

let token = null;

// НОВЫЕ ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ КЛЮЧЕЙ (Установлены из Base64-конфига)
window.DADATA_API_KEY = null; 
window.YANDEX_MAP_KEY = null; 
// ------------------------------

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
    if (typeof firebase === 'undefined' || !firebase.initializeApp) {
        console.error("Firebase SDK not loaded.");
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Не удалось загрузить Firebase SDK. Проверьте подключение в HTML.');
        return false;
    }
    
    // 1. Извлечение Base64-конфига из URL
    const encodedConfig = getUrlParameter('config');
    if (!encodedConfig) {
        console.error("No Base64 config found in URL.");
        // Причина, по которой мы не вызываем showAlert здесь, в том, что index.html 
        // обрабатывает отсутствие конфига отдельно для более чистого отображения.
        return false; 
    }

    try {
        const decodedConfigString = atob(encodedConfig);
        const config = JSON.parse(decodedConfigString);

        // Установка глобальных ключей для других скриптов
        window.DADATA_API_KEY = config.DADATA_TOKEN;
        window.YANDEX_MAP_KEY = config.YMAPS_API_KEY;

        // Инициализация Firebase
        const firebaseConfig = config.FIREBASE_CONFIG_JSON;
        if (!firebaseConfig) {
             console.error("Firebase config is missing from Base64 data.");
             window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Конфигурация Firebase не найдена в URL-параметрах.');
             return false;
        }

        app = firebase.initializeApp(firebaseConfig);
        window.db = firebase.firestore();
        window.auth = firebase.auth();
        
        // Установка Firestore settings для отключения предупреждений
        window.db.settings({ timestampsInSnapshots: true });

        console.log("Firebase initialized successfully.");
        
        return true;

    } catch (error) {
        console.error("Error decoding or initializing Firebase:", error);
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', `Сбой при декодировании конфига или инициализации: ${error.message}`);
        return false;
    }
}

// ----------------------------------------------------------------------
// АУТЕНТИФИКАЦИЯ
// ----------------------------------------------------------------------

window.checkAdminStatus = async function() {
    // Получение DOM-элементов
    const saveButton = document.getElementById('saveButton');
    const debugAdminStatus = document.getElementById('debugAdminStatus');
    const telegramAuthInfo = document.getElementById('telegramAuthInfo');

    if (!window.auth) {
        console.error("Firebase Auth not initialized.");
        return false;
    }

    // 1. Получение токена (Custom Token)
    // Токен передается в URL-параметре user_token, который генерирует бот.
    token = getUrlParameter('user_token');
    if (!token) {
        console.warn("user_token not found in URL. Only agitator role is available.");
        // Если токена нет, это не ошибка, просто пользователь не админ.
        // Продолжаем, но без аутентификации.
        
        if (debugAdminStatus) { 
            debugAdminStatus.textContent = 'НЕТ (Нет Токена)';
        }
        
        if (saveButton) {
            saveButton.removeAttribute('disabled');
        }
        
        if (telegramAuthInfo) {
            telegramAuthInfo.textContent = '⚠️ Токен не найден. Доступна только роль Агитатора.';
        }
        
        return false;
    }

    try {
        // 2. Вход с помощью Custom Token
        const userCredential = await window.auth.signInWithCustomToken(token);
        const user = userCredential.user;

        // 3. Проверка claims (роли)
        const idTokenResult = await user.getIdTokenResult(true);
        const claims = idTokenResult.claims;
        
        window.userTelegramId = claims.telegram_id || user.uid;
        window.userTelegramUsername = claims.username || null;
        
        const tokenAdmin = claims.admin;
        if (tokenAdmin !== undefined) {
             window.isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
        }
        
        // 4. Отображение статуса (ИСПРАВЛЕНО: заменено debugAdminStatus?.textContent = ... на if)
        if (debugAdminStatus) { 
            debugAdminStatus.textContent = window.isAdmin ? 'ДА (Токен)' : 'НЕТ (Токен)';
        }
        
        // 5. Разблокировка кнопки (ИСПРАВЛЕНО: заменено saveButton?.removeAttribute(...) на if)
        if (saveButton) {
            saveButton.removeAttribute('disabled');
        }

        if (telegramAuthInfo) {
            telegramAuthInfo.textContent = `✅ Аутентификация успешна. Роль: ${window.isAdmin ? 'Администратор' : 'Агитатор'}`;
        }
        
        // 6. Показ кнопки администратора
        const adminButton = document.getElementById('adminButton');
        if (window.isAdmin && adminButton) {
             adminButton.style.display = 'flex';
             
             // Для плавной анимации (stagger)
             if (adminButton.classList.contains('stagger-item')) {
                 adminButton.style.opacity = 0; 
                 setTimeout(() => {
                    adminButton.style.opacity = 1; 
                 }, 10);
             }
        }
        
        return true;
    } catch (error) {
        console.error("Firebase Custom Token Auth failed:", error);
        
        // ИСПРАВЛЕНО: БЕЗОПАСНАЯ КОНСТРУКЦИЯ IF
        if (debugAdminStatus) { 
            debugAdminStatus.textContent = 'ОШИБКА АУТЕНТИФИКАЦИИ'; 
        }

        if (telegramAuthInfo) {
            telegramAuthInfo.textContent = '❌ Ошибка аутентификации Firebase.';
        }
        
        window.showAlert('ОШИБКА АУТЕНТИФИКАЦИИ', `Не удалось войти: ${error.message}. Проверьте Custom Token.`);
        return false;
    }
}
