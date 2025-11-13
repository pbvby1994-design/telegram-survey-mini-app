// firebase-auth.js (ОБНОВЛЕННАЯ ВЕРСИЯ - СИНТАКСИС GLOBAL)

// --- Глобальные переменные (доступны в main.js через window.) ---
let app = null;
window.db = null;
window.auth = null;
window.userTelegramId = null;
window.userTelegramUsername = null;
window.isAdmin = false;
window.YMAPS_API_KEY = null;             // НОВЫЙ ГЛОБАЛЬНЫЙ КЛЮЧ
window.DADATA_TOKEN = null;              // НОВЫЙ ГЛОБАЛЬНЫЙ КЛЮЧ
window.DADATA_LOCATION_RESTRICTIONS = []; // НОВЫЙ ГЛОБАЛЬНЫЙ ФИЛЬТР

let token = null;
let firebaseConfig = null;

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
    
    // 1. Считывание и декодирование полной конфигурации Firebase и всех ключей
    const configBase64 = getUrlParameter('firebase_config');
    token = getUrlParameter('token'); 
    
    // Получение user_id и username
    window.userTelegramId = getUrlParameter('user_id');
    window.userTelegramUsername = getUrlParameter('username');
    
    // Проверка наличия минимальных параметров
    if (!configBase64 || !token || !window.userTelegramId) {
         console.error("Не хватает параметров запуска Mini App.");
         window.showAlert('ОШИБКА ЗАПУСКА', 'Не хватает параметров запуска. Запустите Web App из бота.');
         return false;
    }
    
    try {
        const configJsonString = atob(configBase64);
        const fullConfig = JSON.parse(configJsonString);
        
        // --- Установка глобальных переменных из декодированной конфигурации ---
        window.DADATA_TOKEN = fullConfig.dadataToken;
        window.YMAPS_API_KEY = fullConfig.ymapsKey;
        
        // Формирование фильтра Dadata для Сургутского района
        if (fullConfig.dadataFiasId) {
             window.DADATA_LOCATION_RESTRICTIONS = [{ 'region_fias_id': fullConfig.dadataFiasId }];
        } else {
             window.DADATA_LOCATION_RESTRICTIONS = [];
             console.warn("DADATA_LOCATION_FIAS_ID не передан. Фильтрация Dadata неактивна.");
        }
        
        // Конфигурация Firebase для инициализации
        firebaseConfig = {
            apiKey: fullConfig.apiKey,
            authDomain: fullConfig.authDomain,
            projectId: fullConfig.projectId,
            storageBucket: fullConfig.storageBucket,
            messagingSenderId: fullConfig.messagingSenderId,
            appId: fullConfig.appId,
        };
        
    } catch (e) {
        console.error("Ошибка декодирования или парсинга конфигурации:", e);
        window.showAlert('ОШИБКА КОНФИГУРАЦИИ', 'Не удалось декодировать параметры запуска. Обратитесь к администратору.');
        return false;
    }

    // 2. Инициализация Firebase (v8 Syntax)
    if (!firebase.apps.length) {
        app = firebase.initializeApp(firebaseConfig);
    } else {
        app = firebase.app();
    }
    
    window.db = firebase.firestore();
    window.auth = firebase.auth();
    
    // Включение Offline Support (если требуется)
    // window.db.enablePersistence()
    //     .catch(err => {
    //         if (err.code == 'failed-precondition') {
    //             console.warn("Множественные вкладки не поддерживают оффлайн-доступ.");
    //         } else if (err.code == 'unimplemented') {
    //             console.warn("Браузер не поддерживает оффлайн-доступ.");
    //         }
    //     });
        
    return true;
}

// ----------------------------------------------------------------------
// АУТЕНТИФИКАЦИЯ
// ----------------------------------------------------------------------

window.checkAdminStatus = async function() {
    // 1. Проверка наличия Custom Token
    if (!token) {
        console.warn("Custom token not found in URL.");
        document.getElementById('saveButton')?.setAttribute('disabled', 'true');
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
             // Сравниваем строго с true или 'true'
             window.isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
        }
        
        document.getElementById('debugAdminStatus').textContent = window.isAdmin ? 'ДА (Токен)' : 'НЕТ (Токен)';
        document.getElementById('saveButton')?.removeAttribute('disabled');
        
        // Если авторизация прошла успешно, возвращаем true, чтобы продолжить загрузку
        return true;
    } catch (error) {
        console.error("Firebase Custom Token Auth failed:", error);
        window.showAlert('ОШИБКА АУТЕНТИФИКАЦИИ', `Не удалось войти: ${error.message}. Проверьте Custom Token.`);
        document.getElementById('saveButton')?.setAttribute('disabled', 'true');
        document.getElementById('debugAdminStatus').textContent = "ОШИБКА";
        return false;
    }
}
