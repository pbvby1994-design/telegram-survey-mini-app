// firebase-auth.js (ОКОНЧАТЕЛЬНАЯ ВЕРСИЯ - СИНТАКСИЧЕСКИ ПРАВИЛЬНАЯ И БЕЗОПАСНАЯ)

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
    if (!window.firebase || !window.firebase.apps.length) {
        // Проверяем, что библиотеки Firebase загружены
        console.error("Firebase SDK not loaded.");
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Не удалось загрузить Firebase SDK.');
        return false;
    }

    // 1. Получение токена
    token = getUrlParameter('auth_token');
    if (!token) {
        console.error("Firebase Custom Token (auth_token) not found in URL.");
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Токен аутентификации не найден. Пожалуйста, запустите приложение из Telegram.');
        return false;
    }
    
    // 2. Получение Telegram Auth Data
    window.userTelegramId = getUrlParameter('user_id');
    window.userTelegramUsername = getUrlParameter('user_username');

    // 3. Получение Base64 Config
    const configBase64 = getUrlParameter('config');
    if (!configBase64) {
        console.error("Base64 Config not found in URL.");
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Конфигурация Firebase не найдена.');
        return false;
    }

    // 4. Парсинг Config
    let config = {};
    try {
        const configJson = atob(configBase64);
        config = JSON.parse(configJson);
    } catch (error) {
        console.error("Failed to parse or decode Base64 config:", error);
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Не удалось декодировать или распарсить конфигурацию.');
        return false;
    }
    
    // 5. Инициализация Firebase App (если еще не инициализировано)
    if (!app) {
        // Инициализация с данными из Base64 config
        app = window.firebase.initializeApp(config.FIREBASE_CONFIG); 
        window.db = window.firebase.firestore();
        window.auth = window.firebase.auth();
    }
    
    // 6. Установка глобальных ключей API
    if (config.DADATA_TOKEN) {
        window.DADATA_API_KEY = config.DADATA_TOKEN;
    } else {
        console.warn("DADATA_API_KEY is missing from config. Dadata features may not work.");
    }

    if (config.YMAPS_API_KEY) {
        window.YANDEX_MAP_KEY = config.YMAPS_API_KEY;
    } else {
        console.warn("YANDEX_MAP_KEY is missing from config. Yandex Maps may not work.");
    }
    
    // 7. Аутентификация
    const telegramAuthInfo = document.getElementById('telegramAuthInfo');
    const debugAdminStatus = document.getElementById('debugAdminStatus');
    const saveButton = document.getElementById('saveButton'); // Для main.js

    // Вызываем alert и блокируем кнопку немедленно, если аутентификация не удалась
    if (!window.auth) {
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Firebase Auth не инициализирован.');
        saveButton?.disabled = true;
        return false;
    }
    
    // Синхронный вызов аутентификации
    window.auth.signInWithCustomToken(token)
        .then(async (userCredential) => {
            const user = userCredential.user;
            
            // Получение claims (обновляется асинхронно)
            const idTokenResult = await user.getIdTokenResult(true);
            
            // Проверка claims для admin статуса
            const tokenAdmin = idTokenResult.claims.admin;
            if (tokenAdmin !== undefined) {
                // ВАЖНО: Никаких присваиваний в условии, только сравнение
                window.isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
            }
            
            // Отображение статуса
            debugAdminStatus?.textContent = window.isAdmin ? 'ДА (Токен)' : 'НЕТ (Токен)';
            saveButton?.removeAttribute('disabled');
            telegramAuthInfo.textContent = `✅ Аутентификация успешна. Роль: ${window.isAdmin ? 'Администратор' : 'Агитатор'}`;
            
            // Показ кнопки администратора
            if (window.isAdmin && document.getElementById('adminButton')) {
                 document.getElementById('adminButton').style.display = 'flex';
                 
                 // Для плавной анимации (stagger)
                 const adminButton = document.getElementById('adminButton');
                 if (adminButton.classList.contains('stagger-item')) {
                     adminButton.style.opacity = 0; 
                     setTimeout(() => {
                        adminButton.style.opacity = 1; 
                     }, 10);
                 }
            }
            
            return true;
        })
        .catch((error) => {
            console.error("Firebase Custom Token Auth failed:", error);
            
            debugAdminStatus?.textContent = 'ОШИБКА АУТЕНТИФИКАЦИИ'; 
            telegramAuthInfo.textContent = '❌ Ошибка аутентификации Firebase.';
            
            window.showAlert('ОШИБКА АУТЕНТИФИКАЦИИ', `Не удалось войти: ${error.message}. Проверьте Custom Token.`);
            saveButton?.disabled = true;
            return false;
        });

    // Возвращаем true, чтобы основной скрипт продолжил работу (ожидая асинхронной аутентификации)
    return true; 
}
