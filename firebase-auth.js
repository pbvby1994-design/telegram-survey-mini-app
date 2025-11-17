// firebase-auth.js (ES Module)
import { showAlert } from './utils.js';

// --- Модульные переменные (экспортируются) ---
let app = null;
export let db = null;
export let auth = null;
export let userTelegramId = null;
export let userTelegramUsername = null;
export let isAdmin = false;

let token = null;

// Функция для получения параметра из URL
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// ----------------------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ И ПОЛУЧЕНИЕ ПАРАМЕТРОВ ИЗ URL
// ----------------------------------------------------------------------

/**
 * Инициализирует Firebase App, Firestore и Auth.
 * @returns {boolean} - true, если инициализация прошла успешно.
 */
export function initializeFirebase() {
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
        showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Firebase SDK не загружен.');
        return false;
    }
    
    const configBase64 = getUrlParameter('firebase_config');
    token = getUrlParameter('token'); 
    
    userTelegramId = getUrlParameter('user_id');
    userTelegramUsername = getUrlParameter('username');

    if (!configBase64) {
         showAlert('ОШИБКА КОНФИГУРАЦИИ', 'Конфигурация Firebase не найдена в URL.');
         return false;
    }
    
    try {
        const configJson = atob(configBase64);
        const firebaseConfig = JSON.parse(configJson);

        // Инициализация Firebase (v8 Syntax)
        if (!app) {
             app = firebase.initializeApp(firebaseConfig);
             db = app.firestore();
             auth = app.auth();
        }
        
        return true;
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showAlert('КРИТИЧЕСКАЯ ОШИБКА', `Не удалось инициализировать Firebase: ${error.message}.`);
        return false;
    }
}

/**
 * Аутентификация через Custom Token и проверка статуса админа.
 * Обновляет экспортируемую переменную `isAdmin`.
 * @returns {Promise<boolean>}
 */
export async function checkAdminStatus() {
    const telegramAuthInfo = document.getElementById('telegramAuthInfo');
    const debugAdminStatus = document.getElementById('debugAdminStatus');
    const saveButton = document.getElementById('saveButton');
    
    if (!auth || !token) {
        debugAdminStatus?.textContent = 'ОТКАЗ (Нет Auth/Токена)';
        telegramAuthInfo.textContent = '❌ Не удалось получить токен. Используйте бота для входа.';
        return false;
    }
    
    try {
        const userCredential = await auth.signInWithCustomToken(token);
        const idTokenResult = await userCredential.user.getIdTokenResult();
        
        // Перезаписываем isAdmin на основе Claims
        if (idTokenResult.claims && idTokenResult.claims.admin) {
             const tokenAdmin = idTokenResult.claims.admin;
             isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
        }
        
        debugAdminStatus?.textContent = isAdmin ? 'ДА (Токен)' : 'НЕТ (Токен)';
        saveButton?.removeAttribute('disabled');
        telegramAuthInfo.textContent = `✅ Аутентификация успешна. Роль: ${isAdmin ? 'Администратор' : 'Агитатор'}`;
        
        // Показ кнопки администратора
        if (isAdmin && document.getElementById('adminButton')) {
             const adminButton = document.getElementById('adminButton');
             adminButton.style.display = 'flex';
             // ... логика анимации stagger ...
        }
        
        return true;
    } catch (error) {
        console.error("Firebase Custom Token Auth failed:", error);
        
        debugAdminStatus?.textContent = 'ОШИБКА АУТЕНТИФИКАЦИИ'; 
        telegramAuthInfo.textContent = '❌ Ошибка аутентификации Firebase.';
        
        showAlert('ОШИБКА АУТЕНТИФИКАЦИИ', `Не удалось войти: ${error.message}. Проверьте Custom Token.`);
        saveButton?.setAttribute('disabled', 'true');
        
        return false;
    }
}

/**
 * Выход из системы и перенаправление на главную страницу 
 * (Оставлен как window.signOut для совместимости с onclick в HTML)
 */
window.signOut = async function() {
    try {
        if (auth) {
            await auth.signOut();
        }
    } catch (error) {
        console.error("Error signing out:", error);
    } finally {
        window.location.href = 'index.html'; 
    }
}
