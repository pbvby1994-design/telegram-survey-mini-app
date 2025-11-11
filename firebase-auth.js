// firebase-auth.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getFirestore, Timestamp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
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
// ИНИЦИАЛИЗАЦИЯ
// ----------------------------------------------------------------------

export function initializeFirebase() {
    const configBase64 = getUrlParameter('firebase_config');
    token = getUrlParameter('token');
    userTelegramId = getUrlParameter('user_id');

    if (!configBase64 || !token) {
        console.error("Missing Firebase Config or Auth Token in URL.");
        document.getElementById('debugAdminStatus').textContent = "ОШИБКА URL";
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
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', `Не удалось инициализировать Firebase: ${e.message}`);
        document.getElementById('debugAdminStatus').textContent = "ОШИБКА INIT";
        return false;
    }
}

// ----------------------------------------------------------------------
// АУТЕНТИФИКАЦИЯ
// ----------------------------------------------------------------------

export async function authenticateUser() {
    const adminStatus = document.getElementById('debugAdminStatus');
    if (!auth || !token) {
        adminStatus.textContent = 'ОШИБКА';
        return false;
    }
    
    try {
        const userCredential = await signInWithCustomToken(auth, token);
        const idTokenResult = await getIdTokenResult(userCredential.user);
        
        // Проверяем Claims (флаг admin)
        if (idTokenResult.claims && idTokenResult.claims.admin) {
            const tokenAdmin = idTokenResult.claims.admin;
            isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
        }
        
        userTelegramId = idTokenResult.claims.telegram_id || userCredential.user.uid;
        
        document.getElementById('debugUserId').textContent = userTelegramId;
        document.getElementById('debugAdminStatus').textContent = isAdmin ? 'ДА' : 'ПОЛЬЗОВАТЕЛЬ';
        document.getElementById('debugAdminStatus').classList.add(isAdmin ? 'text-green-600' : 'text-green-500');
        
        return true;
    } catch (error) {
        console.error("Firebase Authentication Error:", error);
        window.showAlert('Ошибка Аутентификации', `Не удалось войти: ${error.code}`);
        adminStatus.textContent = 'ОШИБКА';
        return false;
    }
}
