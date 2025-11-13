// config.js
// ВНИМАНИЕ: Все ключи и токены, расположенные здесь, будут доступны в браузере.

// Конфигурация Firebase для клиента (публичный ключ, скопирован из .env)
export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDVeRXO16KtIwoJQb4uHQuCsEv3xTLBGhI",
    authDomain: "agitator-notebook.firebaseapp.com",
    projectId: "agitator-notebook",
    storageBucket: "agitator-notebook.firebasestorage.app",
    messagingSenderId: "518555352011",
    appId: "1:518555352011:web:2b18d460a6fa4acb66944e"
};

// Публичный токен Dadata (скопирован из .env, используется для suggestions/address)
export const DADATA_TOKEN = "29c85666d57139f459e452d1290dd73c23708472";

// Параметры Dadata для фильтрации по регионам (ХМАО - KLADR 86)
export const DADATA_LOCATION_RESTRICTIONS = [
    { 'kladr_id': '86' }, 
];


// --- КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: ПЕРЕДАЧА В WINDOW ---
// Назначение констант глобальному объекту window для доступа из немодульных скриптов
window.FIREBASE_CONFIG = FIREBASE_CONFIG;
window.DADATA_TOKEN = DADATA_TOKEN;
window.DADATA_LOCATION_RESTRICTIONS = DADATA_LOCATION_RESTRICTIONS;
// ---------------------------------------------------
