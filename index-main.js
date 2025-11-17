// index-main.js (ES Module)
import { FIREBASE_CONFIG, DADATA_TOKEN, DADATA_LOCATION_FIAS_ID } from './config.js';
import { initializeFirebase, checkAdminStatus, userTelegramId, userTelegramUsername } from './firebase-auth.js';
import { showAlert, initDarkMode } from './utils.js';

/**
 * Функция для кодирования конфигурации в Base64
 * @param {object} config
 * @returns {string | null}
 */
function encodeFirebaseConfig(config) {
    try {
        const jsonString = JSON.stringify(config);
        return btoa(jsonString);
    } catch (e) {
        console.error("Error encoding Firebase config:", e);
        return null;
    }
}

/**
 * Функция для перенаправления на дашборд (теперь глобально доступна через window.* для обратной совместимости с onclick в HTML)
 * @param {'agitator'|'admin'} role
 */
window.redirectToDashboard = function(role) {
    const firebaseConfig = FIREBASE_CONFIG;
    const dadataToken = DADATA_TOKEN;
    const dadataFiasId = DADATA_LOCATION_FIAS_ID[0]?.kladr_id; // Берем первый элемент как дефолт

    if (!firebaseConfig || !dadataToken) {
         showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Отсутствует конфигурация Firebase или Dadata.');
         return;
    }

    const configBase64 = encodeFirebaseConfig(firebaseConfig);

    const customToken = new URLSearchParams(window.location.search).get('token');

    let targetUrl = `admin_dashboard.html?view=form-view&role=${role}&firebase_config=${configBase64}`;

    if (customToken) {
         targetUrl += `&token=${customToken}`;
    }
    if (userTelegramId) {
        targetUrl += `&user_id=${userTelegramId}`;
    }
    if (userTelegramUsername) {
        targetUrl += `&username=${userTelegramUsername}`;
    }
    targetUrl += `&dadata_token=${dadataToken}`;
    if (dadataFiasId) {
         targetUrl += `&dadata_fias_id=${dadataFiasId}`;
    }

    // Анимация перед переходом
    document.getElementById('welcomeCard')?.classList.remove('loaded');

    if (window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }

    setTimeout(() => {
        window.location.href = targetUrl;
    }, 550);
}

/**
 * Основная логика инициализации index.html
 */
async function initIndexPage() {
    initDarkMode(); // Инициализация темной темы

    // Показываем карточку с анимацией
    document.getElementById('welcomeCard')?.classList.add('loaded');

    if (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp.ready) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
    }

    const firebaseData = initializeFirebase();

    if (firebaseData) {
        // Проверка статуса админа
        await checkAdminStatus(firebaseData.token, firebaseData.dbInstance, firebaseData.authInstance);
    } else {
         document.getElementById('telegramAuthInfo').textContent = '❌ Не удалось загрузить конфигурацию Firebase.';
    }

    // Обновляем информацию о пользователе
    document.getElementById('authUsername').textContent = userTelegramUsername || 'Неизвестно';
    document.getElementById('authUserId').textContent = userTelegramId || 'Неизвестно';

    // Включаем кнопку Агитатора, так как доступ есть у всех
    document.getElementById('agitatorButton').disabled = false;

    // Убеждаемся, что все кнопки-иконки прорисованы
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

document.addEventListener('DOMContentLoaded', initIndexPage);