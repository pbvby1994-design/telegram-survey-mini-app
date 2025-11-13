// firebase-auth.js (ГЛОБАЛЬНАЯ ВЕРСИЯ - БЕЗ ИМПОРТОВ)

// --- Глобальные переменные (доступны в main.js через window.) ---
let app = null;
window.db = null;
window.auth = null;
window.userTelegramId = null;
window.isAdmin = false;

// Token и Config теперь глобально доступны (window.CUSTOM_TOKEN и window.FIREBASE_CONFIG)


// ----------------------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ FIREBASE
// ----------------------------------------------------------------------

window.initializeFirebase = function() {
    // 1. Проверка наличия глобального объекта Firebase и CONFIG
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Firebase SDK не загружен. Проверьте подключение CDN в HTML.');
        return false;
    }
    
    if (!window.FIREBASE_CONFIG) {
         window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Конфигурация Firebase не найдена.');
         return false;
    }
    
    try {
        // 2. Инициализация
        app = firebase.initializeApp(window.FIREBASE_CONFIG);
        
        // 3. Получение сервисов
        window.auth = app.auth();
        window.db = app.firestore();
        
        return true;
    } catch (error) {
         console.error("Firebase initialization failed:", error);
         window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', `Не удалось инициализировать Firebase: ${error.message}`);
         return false;
    }
};

// ----------------------------------------------------------------------
// АУТЕНТИФИКАЦИЯ
// ----------------------------------------------------------------------

window.authenticateUser = async function() {
    
    // 1. Проверка токена
    if (!window.CUSTOM_TOKEN) {
        console.warn("Custom token not found.");
        document.getElementById('saveButton').disabled = true;
        document.getElementById('debugAdminStatus').textContent = "ОТКАЗ (Нет токена)";
        return false;
    }
    
    try {
        // 2. Аутентификация с помощью Custom Token
        const userCredential = await window.auth.signInWithCustomToken(window.CUSTOM_TOKEN);
        
        // 3. Получение Claims (проверка флага админа из токена)
        const idTokenResult = await userCredential.user.getIdTokenResult();
        
        // 4. Установка глобальных переменных
        window.userTelegramId = idTokenResult.claims.telegram_id || idTokenResult.claims.uid;
        
        // Перезаписываем isAdmin на основе Claims
        if (idTokenResult.claims && idTokenResult.claims.admin) {
             const tokenAdmin = idTokenResult.claims.admin;
             window.isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
        }
        
        // 5. Обновление UI
        const debugStatusElement = document.getElementById('debugAdminStatus');
        if (debugStatusElement) {
             debugStatusElement.textContent = window.isAdmin ? 'ДА (Админ)' : 'НЕТ (Пользователь)';
        }
        
        // Включаем кнопку админа на главной странице (если она есть)
        const adminButton = document.getElementById('adminButton');
        if (adminButton && window.isAdmin) {
             adminButton.disabled = false;
        }

        return true;
    } catch (error) {
        console.error("Firebase Custom Token Auth failed:", error);
        window.showAlert('ОШИБКА АУТЕНТИФИКАЦИИ', `Не удалось войти: ${error.message}. Проверьте Custom Token.`);
        document.getElementById('saveButton').disabled = true;
        
        // В случае ошибки аутентификации - сбрасываем isAdmin
        window.isAdmin = false; 
        const debugStatusElement = document.getElementById('debugAdminStatus');
        if (debugStatusElement) {
             debugStatusElement.textContent = "ОТКАЗ (Ошибка токена)";
        }
        return false;
    }
}


/**
 * Проверяет статус администратора (используется на index.html)
 */
window.checkAdminStatus = async function() {
    // 1. Проверка токена
    if (!window.CUSTOM_TOKEN) {
         document.getElementById('telegramAuthInfo').textContent = '❌ Нет токена';
         document.getElementById('adminButton').disabled = true;
         return;
    }
    
    try {
        // 2. Аутентификация
        const userCredential = await window.auth.signInWithCustomToken(window.CUSTOM_TOKEN);
        
        // 3. Получение Claims
        const idTokenResult = await userCredential.user.getIdTokenResult();
        
        // 4. Установка глобальных переменных
        window.userTelegramId = idTokenResult.claims.telegram_id || idTokenResult.claims.uid;
        
        if (idTokenResult.claims && idTokenResult.claims.admin) {
             const tokenAdmin = idTokenResult.claims.admin;
             window.isAdmin = (tokenAdmin === true || String(tokenAdmin).toLowerCase() === 'true');
        }

        // 5. Обновление UI
        const authInfoElement = document.getElementById('telegramAuthInfo');
        if (authInfoElement) {
             authInfoElement.textContent = `✅ ID: ${window.userTelegramId} | Статус: ${window.isAdmin ? 'Админ' : 'Пользователь'}`;
        }
        
        const adminButton = document.getElementById('adminButton');
        if (adminButton) {
             adminButton.disabled = !window.isAdmin;
             if (window.isAdmin) {
                 adminButton.classList.add('bg-green-100', 'text-green-800');
                 adminButton.classList.remove('btn-admin');
             }
        }
        
    } catch (error) {
        console.error("Admin check failed:", error);
        document.getElementById('telegramAuthInfo').textContent = '❌ Ошибка аутентификации';
        document.getElementById('adminButton').disabled = true;
        window.isAdmin = false;
    }
}
