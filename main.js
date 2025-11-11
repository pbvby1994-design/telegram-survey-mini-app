// main.js

import { initializeFirebase, authenticateUser, isAdmin, db, userTelegramId } from './firebase-auth.js';
import { collection, getDocs, addDoc, query, orderBy, Timestamp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// --- Глобальные переменные ---
window.mapInstance = null; // Экземпляр карты Yandex
let currentLatitude = null;
let currentLongitude = null;

// !!! ВОССТАНОВЛЕННЫЙ И ПОЛНЫЙ СПИСОК ВАШИХ НАСЕЛЕННЫХ ПУНКТОВ !!!
const SETTLEMENTS = [
    'г.п. Лянтор', 'с.п. Русскинская', 'г.п. Федоровский', 'г.п. Барсово', 
    'г.п. Белый Яр', 'с.п. Лямина', 'с.п. Сытомино', 'с.п. Угут', 
    'с.п. Ульт-Ягун', 'с.п. Солнечный', 'с.п. Нижнесортымский', 
    'с.п. Тундрино', 'с.п. Локосово'
];

// ----------------------------------------------------------------------
// 1. ЛОГИКА ФОРМЫ И ГЕО
// ----------------------------------------------------------------------

/**
 * Заполняет выпадающий список поселений.
 */
function populateSettlements() {
    const select = document.getElementById('settlement');
    select.innerHTML = '<option value="" disabled selected>Выберите населенный пункт</option>';
    SETTLEMENTS.forEach(s => {
        const option = document.createElement('option');
        option.value = s;
        option.textContent = s;
        select.appendChild(option);
    });
}

/**
 * Получает текущее местоположение и адрес.
 */
window.getGeolocation = function() {
    const geoStatus = document.getElementById('geoStatus');
    const addressInput = document.getElementById('address');
    const geoInput = document.getElementById('geolocation');
    
    geoStatus.textContent = 'Определение...';
    geoStatus.className = 'ml-2 text-xs text-gray-500'; // Сброс классов цвета

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                currentLatitude = position.coords.latitude; 
                currentLongitude = position.coords.longitude;
                geoInput.value = `${currentLatitude.toFixed(6)}, ${currentLongitude.toFixed(6)}`;
                
                // Проверяем, что координаты получены, прежде чем искать адрес
                if (currentLatitude && currentLongitude) {
                    geoStatus.textContent = 'Успешно! Ищем адрес...';
                    
                    // Использование API Яндекс Карт для обратного геокодирования
                    const YANDEX_GEOCODE_URL = `https://geocode-maps.yandex.ru/1.x/?apikey=35d34bfb-514d-42c1-b37d-cb751ea4793e&format=json&geocode=${currentLongitude},${currentLatitude}&kind=house`;
                    
                    let address = "Не удалось определить адрес. Введите вручную.";
                    try {
                        const response = await fetch(YANDEX_GEOCODE_URL);
                        const data = await response.json();
                        
                        const members = data.response.GeoObjectCollection.featureMember;
                        if (members.length > 0) {
                            address = members[0].GeoObject.metaDataProperty.GeocoderMetaData.text;
                            // Убираем город/регион, оставляем только улицу/дом
                            address = address.split(',').slice(-2).join(',').trim();
                        }
                    } catch (e) {
                        console.warn("Yandex Geocoding failed:", e);
                    }
                    
                    addressInput.value = address;
                    geoStatus.textContent = '✅ Успешно!';
                    geoStatus.classList.add('text-green-600');
                    document.getElementById('saveButton').disabled = false; // Разблокировать кнопку
                }
            },
            (error) => {
                // Если геолокация не получена (ошибка или запрет)
                currentLatitude = null;
                currentLongitude = null;
                geoInput.value = 'Нет данных';
                addressInput.value = '';
                geoStatus.textContent = '❌ Ошибка доступа';
                geoStatus.classList.add('text-red-500');
                document.getElementById('saveButton').disabled = false; // Разблокировать, чтобы можно было сохранить без GPS
                window.showAlert('Ошибка GPS', 'Не удалось получить местоположение. Введите адрес вручную.');
            },
            { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
        );
    } else {
        geoStatus.textContent = '❌ Не поддерживается';
        window.showAlert('Ошибка', 'Геолокация не поддерживается вашим устройством.');
        document.getElementById('saveButton').disabled = false;
    }
}

/**
 * Сохранение данных формы в Firestore. (Без изменений)
 */
window.saveSurveyData = async function(event) {
    event.preventDefault();
    const saveStatus = document.getElementById('saveStatus');

    if (!db || !userTelegramId) {
        window.showAlert('Ошибка', 'Приложение не подключено к базе данных или пользователь не авторизован.');
        return;
    }
    
    document.getElementById('saveButton').disabled = true;
    saveStatus.textContent = '⏳ Отправка...';

    const data = {
        reporterId: userTelegramId, 
        timestamp: Timestamp.fromDate(new Date()), 
        
        settlement: document.getElementById('settlement').value,
        address: document.getElementById('address').value,
        loyalty: document.getElementById('loyalty').value,
        action: document.getElementById('action').value, 
        comment: document.getElementById('comment').value || "",
        
        latitude: currentLatitude,
        longitude: currentLongitude
    };
    
    try {
        if (!data.settlement || !data.address || !data.loyalty || !data.action) {
             throw new Error("Не все обязательные поля заполнены.");
        }
        
        await addDoc(collection(db, "reports"), data);
        window.showAlert('Успех', 'Данные успешно сохранены! Спасибо за работу.');
        document.getElementById('surveyForm').reset();
        saveStatus.textContent = '✅ Успешно!';
        
        currentLatitude = null;
        currentLongitude = null;
        document.getElementById('geolocation').value = '';
        document.getElementById('geoStatus').textContent = '(Нажмите кнопку ниже)';
        document.getElementById('geoStatus').classList.remove('text-green-600', 'text-red-500');
        document.getElementById('geoStatus').classList.add('text-gray-500');

        setTimeout(() => saveStatus.textContent = 'Готов', 3000);
    } catch (e) {
        console.error("Error adding document: ", e);
        window.showAlert('Ошибка', `Не удалось сохранить данные: ${e.message}.`);
        saveStatus.textContent = 'Ошибка';
    } finally {
        document.getElementById('saveButton').disabled = false;
    }
}

// ----------------------------------------------------------------------
// 2. ЛОГИКА КАРТЫ (Админ)
// ----------------------------------------------------------------------

/**
 * Вызывается автоматически после загрузки API Яндекс Карт (onload=initMap).
 */
window.initMap = async function() {
    if (typeof ymaps === 'undefined') {
        console.error("Яндекс API не определен.");
        document.getElementById('map-loading-status').textContent = 'Ошибка загрузки API Яндекс Карт.';
        return;
    }
    
    if (window.mapInstance) return;
    
    // Центр по умолчанию (Сургутский район)
    window.mapInstance = new ymaps.Map("map-container", {
        center: [61.25, 73.4], 
        zoom: 9,
        controls: ['zoomControl', 'fullscreenControl']
    });
    
    document.getElementById('map-loading-status').style.display = 'none';
    
    // *КРИТИЧНОЕ ИСПРАВЛЕНИЕ*: Запускаем загрузку отчетов только если админ
    if (isAdmin) {
        await fetchAndLoadReportsToMap();
    } else {
        document.getElementById('map-container').innerHTML = `<div class="p-6 text-red-500 text-center">Доступ к карте только для Администраторов.</div>`;
    }
};

/**
 * Загружает отчеты из Firestore и размещает маркеры на карте. (Без изменений)
 */
async function fetchAndLoadReportsToMap() {
    if (!db) return;
    
    try {
        const reportsCollection = collection(db, "reports");
        const q = query(reportsCollection, orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (reports.length === 0) {
            document.getElementById('map-loading-status').textContent = 'Отчетов с геолокацией не найдено.';
            document.getElementById('map-loading-status').style.display = 'block';
            return;
        }

        const objectManager = new ymaps.ObjectManager({
            clusterize: true, 
            gridSize: 32
        });
        
        const loyaltyMap = {
            'strong': 'Положительно',
            'moderate': 'Скорее положительно',
            'neutral': 'Нейтрально',
            'against': 'Отрицательно'
        };

        const features = reports.filter(r => r.latitude && r.longitude).map(r => {
            const date = r.timestamp ? new Date(r.timestamp.toDate()).toLocaleDateString('ru-RU') : 'N/A';
            const loyaltyText = loyaltyMap[r.loyalty] || r.loyalty;
            const preset = r.loyalty === 'against' ? 'islands#redDotIcon' : 'islands#blueDotIcon';

            const content = `
                <div>
                    <strong>${r.settlement}</strong>, ${r.address}<br>
                    Лояльность: <strong>${loyaltyText}</strong><br>
                    Действие: ${r.action || 'N/A'}<br>
                    Комментарий: ${r.comment || 'Нет'}<br>
                    Дата: ${date}
                </div>
            `;

            return {
                type: 'Feature',
                id: r.id,
                geometry: {
                    type: 'Point',
                    coordinates: [r.latitude, r.longitude] 
                },
                properties: {
                    balloonContent: content,
                    hintContent: `${r.settlement}: ${loyaltyText}`
                },
                options: {
                    preset: preset
                }
            };
        });

        objectManager.add(features);
        window.mapInstance.geoObjects.add(objectManager);
        
        if (features.length > 0) {
            window.mapInstance.setBounds(objectManager.getBounds(), { checkZoom: true, zoomMargin: 30 });
        }
        
    } catch (e) {
        console.error("Ошибка загрузки отчетов:", e);
        window.showAlert('Ошибка', `Не удалось загрузить отчеты для карты: ${e.message}`);
    }
}


// ----------------------------------------------------------------------
// 3. ГЛАВНЫЙ БЛОК ИНИЦИАЛИЗАЦИИ
// ----------------------------------------------------------------------

window.onload = async () => {
    // Делаем функции доступными для HTML
    window.showSection = window.showSection; 
    window.changeRole = window.changeRole;
    window.showAlert = window.showAlert;
    window.closeAlert = window.closeAlert;
    
    populateSettlements();
    lucide.createIcons();
    document.getElementById('saveButton').disabled = true;

    if (!initializeFirebase()) {
         showSection('form');
         return;
    }

    const isAuthenticated = await authenticateUser();
    
    if (isAuthenticated) {
         // Показать кнопку "Карта", если пользователь - админ
         if (isAdmin) {
             document.getElementById('btn-map-view').style.display = 'inline-block';
         }
         
         const urlParams = new URLSearchParams(window.location.search);
         const initialView = urlParams.get('view');
         
         let startSection = 'form';
         // Если админ, по умолчанию показываем карту, иначе форму
         if (isAdmin && (initialView === 'map' || initialView === 'map-view' || !initialView)) {
             startSection = 'map-view';
             // Если мы стартуем с карты, запускаем ее инициализацию
             if (typeof ymaps !== 'undefined') {
                window.initMap(); 
             }
         }
         
         window.showSection(startSection);
         document.getElementById('saveButton').disabled = false;
         
    } else {
         window.showSection('form');
         document.getElementById('saveButton').disabled = true;
         document.getElementById('geoStatus').textContent = 'Нет доступа.';
    }
};
