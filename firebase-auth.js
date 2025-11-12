// firebase-auth.js (МОДУЛЬНАЯ ВЕРСИЯ - СОВМЕСТИМОСТЬ V9+)

// --- Глобальные переменные ---
window.app = null;
window.db = null;
window.auth = null;
window.userTelegramId = null;
window.isAdmin = false;
// Placeholder для showAlert. Полная функция в admin_dashboard.html
window.showAlert = function(title, message) { 
    if (typeof document !== 'undefined') {
        // Если это index.html, используем базовый модал
        const titleEl = document.getElementById('alertTitle');
        const msgEl = document.getElementById('alertMessage');
        const modalEl = document.getElementById('alertModal');
        if (titleEl && msgEl && modalEl) {
             titleEl.textContent = title;
             msgEl.textContent = message;
             modalEl.classList.remove('hidden');
             modalEl.classList.add('flex');
             return;
        }
    }
    console.error(`ALERT: ${title} - ${message}`); 
}; 

let token = null;

function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// ----------------------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ
// ----------------------------------------------------------------------

window.initializeFirebase = function() {
    // 1. Считывание конфигурации из config.js
    // Предполагается, что config.js загрузил константы в window
    if (typeof window.FIREBASE_CONFIG === 'undefined') {
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Конфигурация FIREBASE_CONFIG не найдена. Проверьте подключение config.js.');
        return false;
    }
    const firebaseConfig = window.FIREBASE_CONFIG;

    // Считывание Custom Token и ID
    token = getUrlParameter('token'); 
    const url_user_id = getUrlParameter('user_id');

    if (url_user_id) {
        window.userTelegramId = String(url_user_id);
    }
    
    // 2. Инициализация Firebase
    try {
        window.app = firebase.initializeApp(firebaseConfig);
        window.db = firebase.firestore(window.app);
        window.auth = firebase.auth(window.app);
        
        if (window.userTelegramId) {
             // Элемент telegramAuthInfo есть только в index.html
             const infoEl = document.getElementById('telegramAuthInfo');
             if (infoEl) infoEl.textContent = `✅ Telegram ID: ${window.userTelegramId}`;
        } else {
             window.showAlert('ПРЕДУПРЕЖДЕНИЕ', 'Telegram ID не передан. Аутентификация будет невозможна.');
             return false;
        }

        return true;
    } catch (e) {
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', `Не удалось инициализировать Firebase: ${e.message}`);
        console.error("Firebase initialization failed:", e);
        return false;
    }
}

// ----------------------------------------------------------------------
// АУТЕНТИФИКАЦИЯ (для index.html и main.js)
// ----------------------------------------------------------------------

/**
 * Проверяет статус админа для index.html (выбор роли).
 */
window.checkAdminStatus = async function() {
    if (!window.auth) return;

    try {
        if (token) {
            const userCredential = await window.auth.signInWithCustomToken(token);
            const idTokenResult = await userCredential.user.getIdTokenResult();
            
            if (idTokenResult.claims && idTokenResult.claims.admin) {
                 const tokenAdmin = idTokenResult.claims.admin;
                 window.isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
            }
            
            const infoEl = document.getElementById('telegramAuthInfo');
            if (infoEl) infoEl.textContent += window.isAdmin ? ' | ✅ Администратор (Токен)' : ' | ⚠️ Пользователь (Токен)';

        } else {
            await window.auth.signInAnonymously();
            window.isAdmin = false;
            const infoEl = document.getElementById('telegramAuthInfo');
            if (infoEl) infoEl.textContent += ' | 👤 Анонимный вход';
        }

    } catch (error) {
        console.error("Firebase Auth failed:", error);
        window.showAlert('ОШИБКА АУТЕНТИФИКАЦИИ', `Не удалось войти: ${error.message}.`);
        window.isAdmin = false;
    }
}

/**
 * Аутентификация пользователя для основного приложения (admin_dashboard.html / main.js).
 */
window.authenticateUser = async function() {
    // Элемент debugAdminStatus есть только в admin_dashboard.html
    const statusEl = document.getElementById('debugAdminStatus');
    
    if (!token) {
        // Анонимная аутентификация, чтобы разрешить запись данных (если это не админ-панель)
        await window.auth.signInAnonymously();
        window.isAdmin = false;
        if (statusEl) statusEl.textContent = "ОТКАЗ (Нет токена / Аноним)";
        return true; 
    }
    
    try {
        const userCredential = await window.auth.signInWithCustomToken(token);
        const idTokenResult = await userCredential.user.getIdTokenResult();
        
        if (idTokenResult.claims && idTokenResult.claims.admin) {
             const tokenAdmin = idTokenResult.claims.admin;
             window.isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
        }
        
        if (statusEl) {
            statusEl.textContent = window.isAdmin ? '✅ ДА (Токен)' : '⚠️ НЕТ (Токен)';
            if (window.isAdmin) statusEl.classList.replace('text-red-500', 'text-green-600');
        }
        
        return true;
    } catch (error) {
        console.error("Firebase Custom Token Auth failed:", error);
        window.showAlert('ОШИБКА АУТЕНТИФИКАЦИИ', `Не удалось войти: ${error.message}. Проверьте Custom Token.`);
        if (statusEl) statusEl.textContent = "❌ ОШИБКА";
        return false;
    }
}
