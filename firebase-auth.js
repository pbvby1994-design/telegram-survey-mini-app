// firebase-auth.js
// ИСПОЛЬЗУЕМ ПОЛНЫЕ URL ДЛЯ ИМПОРТА МОДУЛЕЙ FIREBASE (Решение №2)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, addDoc, Timestamp, query, getDocs, orderBy, where } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth, signInWithCustomToken, getIdTokenResult } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';


// --- Глобальные переменные и экспорты ---
let app = null;
export let db = null;
export let auth = null;
export let userTelegramId = null;
export let isAdmin = false;

let auth_token = null;

// --- УСИЛЕННАЯ ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ПАРАМЕТРОВ ---
function getUrlParameter(name) {
    let value = null;
    
    // 1. Поиск в стандартной строке запроса (?)
    const urlParamsSearch = new URLSearchParams(window.location.search);
    value = urlParamsSearch.get(name);

    // 2. Если не найдено, ищем в хеше (#) - частое место в Telegram WebApp
    if (!value && window.location.hash) {
        // Убираем # перед парсингом
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        value = hashParams.get(name);
    }
    
    return value;
}

// ----------------------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ И ПОЛУЧЕНИЕ ПАРАМЕТРОВ ИЗ URL
// ----------------------------------------------------------------------

export function initializeFirebase() {
    // 1. Считывание и декодирование конфигурации Firebase
    const configBase64 = getUrlParameter('firebase_config');
    auth_token = getUrlParameter('token'); 
    
    // Получение ID пользователя и статуса админа из URL (для UI-отладки)
    const url_user_id = getUrlParameter('user_id');
    const url_is_admin = getUrlParameter('is_admin'); 
    
    if (url_user_id) {
        userTelegramId = url_user_id;
        document.getElementById('debugUserId').textContent = userTelegramId;
    }
    if (url_is_admin) {
        isAdmin = (url_is_admin.toLowerCase() === 'true');
        document.getElementById('debugAdminStatus').textContent = isAdmin ? 'ДА (URL)' : 'НЕТ (URL)';
    }

    if (!configBase64) {
        console.error("Firebase config not found in URL parameters. Initialization failed.");
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Не удалось найти конфигурацию Firebase в URL. Проверьте генерацию ссылки ботом.');
        document.getElementById('debugAdminStatus').textContent = "ОШИБКА URL";
        return null;
    }

    try {
        // Очищаем Base64 от невидимых символов перед atob()
        const cleanedBase64 = configBase64.replace(/\s/g, ''); 
        
        // Декодирование Base64
        const decodedConfig = atob(cleanedBase64);
        const firebaseConfig = JSON.parse(decodedConfig);
        
        // 2. Инициализация приложения
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        return auth_token; // Возвращаем токен для следующего шага
    } catch (e) {
        console.error("Failed to decode or initialize Firebase:", e);
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', `Не удалось инициализировать Firebase: ${e.message}. Проверьте кодирование Base64.`);
        document.getElementById('debugAdminStatus').textContent = "ОШИБКА INIT";
        return null;
    }
}

// ----------------------------------------------------------------------
// АУТЕНТИФИКАЦИЯ
// ----------------------------------------------------------------------

export async function authenticateUser(customToken) {
    if (!auth || !customToken) {
        document.getElementById('saveButton').disabled = true;
        document.getElementById('debugAdminStatus').textContent = "ОТКАЗ (Нет токена)";
        return false;
    }
    
    try {
        // 3. Аутентификация с помощью Custom Token
        const userCredential = await signInWithCustomToken(auth, customToken);
        
        // 4. Получение Claims (проверка флага админа из токена)
        const idTokenResult = await getIdTokenResult(userCredential.user);
        
        // Перезаписываем isAdmin на основе Claims (этот флаг имеет приоритет)
        if (idTokenResult.claims && idTokenResult.claims.admin !== undefined) {
            const tokenAdmin = idTokenResult.claims.admin;
            isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
        }
        
        document.getElementById('debugAdminStatus').textContent = isAdmin ? 'ДА (Токен)' : 'НЕТ (Токен)';
        document.getElementById('saveButton').disabled = false;
        
        return true;
    } catch (error) {
        console.error("Firebase Custom Token Auth failed:", error);
        window.showAlert('ОШИБКА АУТЕНТИФИКАЦИИ', `Не удалось войти: ${error.message}. Проверьте Custom Token.`);
        document.getElementById('saveButton').disabled = true;
        document.getElementById('debugAdminStatus').textContent = "ОТКАЗ (Токен недействителен)";
        return false;
    }
}

// Экспорт необходимых функций/констант для других модулей
export { collection, addDoc, Timestamp, query, getDocs, orderBy, where };
