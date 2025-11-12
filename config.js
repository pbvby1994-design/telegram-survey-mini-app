// config.js
//
// !!! ВНИМАНИЕ: Все ключи и токены, расположенные здесь, будут доступны в браузере.
// Секретный ключ Dadata (DADATA_SECRET) НЕ должен здесь находиться.

// Конфигурация Firebase для клиента (публичный ключ)
// Соответствует FIREBASE_CONFIG_JSON из вашего запроса
export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDVeRXO16KtIwoJQb4uHQuCsEv3xTLBGhI",
    authDomain: "agitator-notebook.firebaseapp.com",
    projectId: "agitator-notebook",
    storageBucket: "agitator-notebook.firebasestorage.app",
    messagingSenderId: "518555352011",
    appId: "1:518555352011:web:2b18d460a6fa4acb66944e"
};

// Публичный токен Dadata (только для подсказок)
// (29c85666d57139f459e452d1290dd73c23708472)
export const DADATA_TOKEN = "29c85666d57139f459e452d1290dd73c23708472";

// Параметры Dadata для фильтрации по регионам (ХМАО - KLADR 86)
export const DADATA_LOCATION_RESTRICTIONS = [
    { 'kladr_id': '86' },
];

// Для доступа к этим константам в других скриптах используйте:
// import { FIREBASE_CONFIG, DADATA_TOKEN, DADATA_LOCATION_RESTRICTIONS } from './config.js';