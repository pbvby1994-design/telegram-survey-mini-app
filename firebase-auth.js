// firebase-auth.js

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInWithCustomToken, getIdTokenResult } from 'firebase/auth';

// --- Глобальные переменные ---
let app = null;
export let db = null;
export let auth = null;
export let userTelegramId = null;
export let isAdmin = false;

let token = null;

// Функция для получения параметра из URL
function getUrlParameter(name) {
    // Используем window.Telegram.WebApp.initDataUnsafe.query_id для надежности в WebApp
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// ----------------------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ И ПОЛУЧЕНИЕ ПАРАМЕТРОВ ИЗ URL
// ----------------------------------------------------------------------

export function initializeFirebase() {
    // 1. Считывание и декодирование конфигурации Firebase
    const configBase64 = getUrlParameter('firebase_config');
    token = getUrlParameter('token'); 
    
    // Получение user_id и admin_status
    const url_user_id = getUrlParameter('user_id');
    const url_is_admin = getUrlParameter('is_admin'); 
    
    if (url_user_id) {
        userTelegramId = url_user_id;
        document.getElementById('debugUserId').textContent = userTelegramId;
    }
    if (url_is_admin) {
        // Логика: 'true' (string) -> true (boolean)
        isAdmin = (url_is_admin.toLowerCase() === 'true');
        document.getElementById('debugAdminStatus').textContent = isAdmin ? 'ДА' : 'НЕТ';
    }

    if (!configBase64) {
        console.error("Firebase config not found in URL parameters.");
        return null;
    }

    try {
        // Декодирование Base64 (должно работать, так как на Python стороне кодирование верно)
        const decodedConfig = atob(configBase64);
        const firebaseConfig = JSON.parse(decodedConfig);
        
        // 2. Инициализация приложения
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        return token; // Возвращаем токен для следующего шага
    } catch (e) {
        console.error("Failed to decode or initialize Firebase:", e);
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Не удалось инициализировать Firebase. Проверьте конфигурацию в .env и URL-параметры.');
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
        
        // Перезаписываем isAdmin на основе Claims (этот шаг для двойной проверки)
        if (idTokenResult.claims && idTokenResult.claims.admin) {
            const tokenAdmin = idTokenResult.claims.admin;
             // Снова проверяем, что 'true' (string) -> true (boolean)
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
