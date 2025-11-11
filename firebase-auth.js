// firebase-auth.js

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getFirestore, collection, getDocs, doc, setDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { getAuth, signInWithCustomToken, getIdTokenResult } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';

// --- Глобальные переменные ---
let app = null;
export let db = null;
export let auth = null;
export let userTelegramId = null;
export let isAdmin = false;
export let token = null;

// Функция для получения параметра из URL
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// ----------------------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ И ПОЛУЧЕНИЕ ПАРАМЕТРОВ ИЗ URL
// ----------------------------------------------------------------------

/**
 * Инициализирует Firebase, считывая конфигурацию и токен из URL.
 * @returns {boolean} True, если инициализация успешна.
 */
export function initializeFirebase() {
    // 1. Считывание и декодирование конфигурации Firebase
    const configBase64 = getUrlParameter('firebase_config'); // ИСПРАВЛЕНО имя параметра
    token = getUrlParameter('token');                       // ИСПРАВЛЕНО имя параметра
    userTelegramId = getUrlParameter('user_id');            // ИСПРАВЛЕНО имя параметра
    
    if (!configBase64 || !token) {
        console.error("Missing Firebase Config or Auth Token in URL.");
        return false;
    }
    
    try {
        const cleanedBase64 = configBase64.replace(/\s/g, ''); 
        const decodedConfig = atob(cleanedBase64);
        const firebaseConfig = JSON.parse(decodedConfig);
        
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        
        return true;
    } catch (e) {
        console.error("Firebase Initialization Failed:", e);
        return false;
    }
}

/**
 * Аутентифицирует пользователя с помощью Custom Token.
 * @returns {Promise<boolean>} True, если аутентификация успешна.
 */
export async function authenticateUser() {
    if (!token) {
        console.error("No custom token found for authentication.");
        return false;
    }
    
    try {
        // 1. Аутентификация с помощью Custom Token
        const userCredential = await signInWithCustomToken(auth, token);
        
        // 2. Получение Claims (проверка флага админа из токена)
        const idTokenResult = await getIdTokenResult(userCredential.user);
        
        // Установка флага isAdmin на основе Claims
        if (idTokenResult.claims && idTokenResult.claims.admin) {
            const tokenAdmin = idTokenResult.claims.admin;
             // Клейм может прийти как boolean или как string "true"/"false"
            isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
        }
        
        return true;
    } catch (error) {
        console.error("Firebase Custom Token Auth failed:", error);
        alert(`ОШИБКА АУТЕНТИФИКАЦИИ: Не удалось войти. Код: ${error.code}.`);
        return false;
    }
}
