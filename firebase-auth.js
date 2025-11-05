// firebase-auth.js

// Импорты Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, getAuth, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ (Будут экспортированы) ---
// Экспортируем все Firebase SDK методы, которые могут понадобиться в других модулях
export { getFirestore, getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
export { collection, addDoc, Timestamp, query, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// Переменные состояния
export let db = null;
export let auth = null;
export let userTelegramId = null;
export let isAdmin = false;

// --- УТИЛИТЫ ---
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ?
        '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};


// --- ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ ---
export function initializeFirebase() {
    const firebaseConfigStrB64 = getUrlParameter('firebaseConfigB64');
    const initialAuthToken = getUrlParameter('initialAuthToken');
    const urlUserTelegramId = getUrlParameter('telegramUserId');
    let firebaseConfig = {};

    if (firebaseConfigStrB64) {
        try {
            const firebaseConfigJson = atob(firebaseConfigStrB64);
            firebaseConfig = JSON.parse(firebaseConfigJson);
        } catch (e) {
            console.error("Failed to decode or parse firebaseConfig from URL:", e);
        }
    }

    if (firebaseConfig.projectId) {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
    } else {
        window.showAlert('ВНИМАНИЕ', 'Конфигурация Firebase не загружена. Проверьте передачу Base64 параметра.');
    }

    // Установка начальных значений
    userTelegramId = urlUserTelegramId || null;
    return initialAuthToken; // Возвращаем токен для следующего шага
}


// --- ФУНКЦИЯ АУТЕНТИФИКАЦИИ ---
export async function authenticateUser(initialAuthToken) {
    const adminStatus = document.getElementById('debugAdminStatus');
    adminStatus.textContent = 'Подключение...';
    adminStatus.classList.remove('text-red-500');
    adminStatus.classList.add('text-yellow-500');

    if (!auth || !initialAuthToken) {
        adminStatus.textContent = 'ОШИБКА ТОКЕНА';
        return false;
    }

    try {
        const userCredential = await signInWithCustomToken(auth, initialAuthToken);
        const tokenResult = await userCredential.user.getIdTokenResult();

        // Обновляем глобальные переменные
        userTelegramId = tokenResult.claims.telegram_id || userCredential.user.uid;
        const adminClaim = tokenResult.claims.admin;
        isAdmin = (adminClaim === true) || (adminClaim === 'true');

        // Обновляем UI
        document.getElementById('debugUserId').textContent = userTelegramId;
        document.getElementById('debugAdminStatus').textContent = isAdmin ? 'ДА' : 'ПОЛЬЗОВАТЕЛЬ';
        document.getElementById('debugAdminStatus').classList.remove('text-yellow-500', 'text-red-500');
        document.getElementById('debugAdminStatus').classList.add(isAdmin ? 'text-green-600' : 'text-green-500');

        document.getElementById('saveButton').disabled = false;
        return true;
    } catch (error) {
        console.error("Firebase Authentication Error:", error);
        document.getElementById('debugAdminStatus').textContent = 'ОШИБКА: ' + error.code;
        document.getElementById('debugAdminStatus').classList.remove('text-yellow-500');
        document.getElementById('debugAdminStatus').classList.add('text-red-500');
        window.showAlert('Ошибка Аутентификации', `Не удалось войти: ${error.code}. Проверьте ключи.`, false, null);
        return false;
    }
}