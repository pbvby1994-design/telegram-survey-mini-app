// main.js (ГЛОБАЛЬНАЯ ВЕРСИЯ - БЕЗ ИМПОРТОВ)

// --- Глобальные переменные ---
window.mapInstance = null; 
let currentLatitude = null; 
let currentLongitude = null;
let dadataCoords = null;    

// --- КОНФИГУРАЦИЯ DADATA ---
const DADATA_API_KEY = '29c85666d57139f459e452d1290dd73c23708472'; 

// Ваши населенные пункты
const SETTLEMENTS = [
    'г.п. Лянтор', 'с.п. Русскинская', 'г.п. Федоровский', 'г.п. Барсово', 
    'г.п. Белый Яр', 'с.п. Лямина', 'с.п. Сытомино', 'с.п. Угут', 
    'с.п. Ульт-Ягун', 'с.п. Солнечный', 'с.п. Нижнесортымский', 
    'с.п. Тундрино', 'с.п. Локосово'
];

// ----------------------------------------------------------------------
// 1. ИНТЕГРАЦИЯ DADATA 
// ----------------------------------------------------------------------

function initDadata() {
    // Эта функция вызывается внутри $(document).ready(), поэтому $ должен быть доступен.
    $("#address").suggestions({
        token: DADATA_API_KEY,
        type: "ADDRESS",
        bounds: { "city_area": "Сургутский район" }, 
        onSelect: function(suggestion) {
            if (suggestion.data.geo_lat && suggestion.data.geo_lon) {
                dadataCoords = {
                    latitude: parseFloat(suggestion.data.geo_lat),
                    longitude: parseFloat(suggestion.data.geo_lon)
                };
            } else {
                dadataCoords = null;
            }
        }
    });
}

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

window.getGeolocation = function() {
    const geoStatus = document.getElementById('geoStatus');
    const geoInput = document.getElementById('geolocation');
    
    dadataCoords = null; 
    
    geoStatus.textContent = 'Определение...';
    geoStatus.className = 'ml-2 text-xs text-gray-500';

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLatitude = position.coords.latitude; 
                currentLongitude = position.coords.longitude;
                geoInput.value = `${currentLatitude.toFixed(6)}, ${currentLongitude.toFixed(6)}`;
                
                geoStatus.textContent = '✅ GPS получен!';
                geoStatus.classList.add('text-green-600');
                document.getElementById('saveButton').disabled = false;
            },
            (error) => {
                currentLatitude = null;
                currentLongitude = null;
                geoInput.value = 'Нет данных';
                geoStatus.textContent = '❌ Ошибка GPS';
                geoStatus.classList.add('text-red-500');
                document.getElementById('saveButton').disabled = false; 
                window.showAlert('Ошибка GPS', 'Не удалось получить местоположение. Введите адрес через Dadata.');
            },
            { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
        );
    } else {
        geoStatus.textContent = '❌ Не поддерживается';
        window.showAlert('Ошибка', 'Геолокация не поддерживается вашим устройством.');
        document.getElementById('saveButton').disabled = false;
    }
}

window.saveSurveyData = async function(event) {
    event.preventDefault();
    const saveStatus = document.getElementById('saveStatus');

    if (typeof db === 'undefined' || typeof userTelegramId === 'undefined') {
        window.showAlert('Ошибка', 'Приложение не подключено к базе данных или пользователь не авторизован.');
        return;
    }
    
    document.getElementById('saveButton').disabled = true;
    saveStatus.textContent = '⏳ Отправка...';

    let finalLatitude = currentLatitude;
    let finalLongitude = currentLongitude;
    
    if (!finalLatitude && dadataCoords) {
        finalLatitude = dadataCoords.latitude;
        finalLongitude = dadataCoords.longitude;
    }

    const data = {
        reporterId: userTelegramId, 
        // Используем глобальный объект Firebase v8
        timestamp: firebase.firestore.Timestamp.fromDate(new Date()), 
        
        settlement: document.getElementById('settlement').value,
        address: document.getElementById('address').value,
        loyalty: document.getElementById('loyalty').value,
        action: document.getElementById('action').value, 
        comment: document.getElementById('comment').value || "",
        
        latitude: finalLatitude,
        longitude: finalLongitude
    };
    
    try {
        if (!data.settlement || !data.address || !data.loyalty || !data.action) {
             throw new Error("Не все обязательные поля заполнены.");
        }
        
        // Синтаксис Firestore v8
        await db.collection("reports").add(data);
        window.showAlert('Успех', 'Данные успешно сохранены! Спасибо за работу.');
        
        document.getElementById('surveyForm').reset();
        currentLatitude = null;
        currentLongitude = null;
        dadataCoords = null;
        document.getElementById('geolocation').value = '';
        document.getElementById('geoStatus').textContent = '(Нажмите кнопку ниже)';
        document.getElementById('geoStatus').className = 'ml-2 text-xs text-gray-500';

        saveStatus.textContent = '✅ Успешно!';
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
// 3. ЛОГИКА КАРТЫ (Админ) 
// ----------------------------------------------------------------------

window.initMap = async function() {
    if (typeof ymaps === 'undefined') {
        document.getElementById('map-loading-status').textContent = 'Ошибка загрузки API Яндекс Карт.';
        return;
    }
    
    if (window.mapInstance) return; 
    
    window.mapInstance = new ymaps.Map("map-container", {
        center: [61.25, 73.4], 
        zoom: 9,
        controls: ['zoomControl', 'fullscreenControl']
    });
    
    document.getElementById('map-loading-status').style.display = 'none';
    
    // Использует глобальный isAdmin
    if (window.isAdmin) {
        await fetchAndLoadReportsToMap();
    } else {
        document.getElementById('map-container').innerHTML = `<div class="p-6 text-red-500 text-center">Доступ к карте только для Администраторов.</div>`;
    }
};

async function fetchAndLoadReportsToMap() {
    if (typeof db === 'undefined' || !window.mapInstance) return;
    
    try {
        if (window.objectManager) {
            window.objectManager.removeAll();
        } else {
            window.objectManager = new ymaps.ObjectManager({
                clusterize: true, 
                gridSize: 32
            });
            window.mapInstance.geoObjects.add(window.objectManager);
        }
        
        // Синтаксис Firestore v8
        const snapshot = await db.collection("reports").orderBy("timestamp", "desc").get();
        const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (reports.length === 0) {
            document.getElementById('map-loading-status').textContent = 'Отчетов с геолокацией не найдено.';
            document.getElementById('map-loading-status').style.display = 'block';
            return;
        }

        const loyaltyMap = {
            'strong': 'Положительно', 'moderate': 'Скорее положительно',
            'neutral': 'Нейтрально', 'against': 'Отрицательно'
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

        window.objectManager.add(features);
        document.getElementById('map-loading-status').style.display = 'none';
        
        if (features.length > 0) {
            window.mapInstance.setBounds(window.objectManager.getBounds(), { checkZoom: true, zoomMargin: 30 });
        }
        
    } catch (e) {
        console.error("Ошибка загрузки отчетов:", e);
        window.showAlert('Ошибка', `Не удалось загрузить отчеты для карты: ${e.message}`);
        document.getElementById('map-loading-status').textContent = 'Ошибка загрузки данных.';
        document.getElementById('map-loading-status').style.display = 'block';
    }
}


// ----------------------------------------------------------------------
// 4. ГЛАВНЫЙ БЛОК (Запуск после загрузки DOM и JQuery)
// ----------------------------------------------------------------------

$(document).ready(async function() { // Используем JQUERY для гарантированной загрузки $
    
    // Инициализация Dadata и списка поселений
    populateSettlements();
    initDadata(); // <--- Теперь безопасно
    lucide.createIcons();
    document.getElementById('saveButton').disabled = true;

    // Проверка наличия глобальных функций, экспортированных из firebase-auth.js
    if (typeof initializeFirebase === 'undefined' || typeof authenticateUser === 'undefined') {
         window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Проверьте подключение Firebase в HTML. Скрипты не найдены.');
         window.showSection('form');
         return;
    }
    
    if (!initializeFirebase()) {
         window.showSection('form');
         return;
    }

    const isAuthenticated = await authenticateUser();
    
    if (isAuthenticated) {
         if (window.isAdmin) {
             document.getElementById('btn-map-view').style.display = 'inline-block';
         }
         
         const urlParams = new URLSearchParams(window.location.search);
         const initialView = urlParams.get('view');
         
         let startSection = 'form';
         if (window.isAdmin && (initialView === 'map' || initialView === 'map-view' || !initialView)) {
             startSection = 'map-view';
         }
         
         window.showSection(startSection);
         document.getElementById('saveButton').disabled = false;
         
         if (startSection === 'map-view' && window.isAdmin && typeof ymaps !== 'undefined') {
             window.initMap();
         }
         
    } else {
         window.showSection('form');
         document.getElementById('saveButton').disabled = true;
         document.getElementById('geoStatus').textContent = 'Нет доступа.';
    }
});
