// main.js (ВЕРСИЯ С DADATA FETCH API)

// --- Глобальные переменные ---
window.mapInstance = null; 
let currentLatitude = null; 
let currentLongitude = null;
let dadataCoords = null;    

// --- КОНФИГУРАЦИЯ DADATA ---
const DADATA_API_KEY = '29c85666d57139f459e452d1290dd73c23708472'; 
let selectedSuggestionData = null; 

// Ваши населенные пункты (УДАЛЕНО, так как теперь используется Dadata)
// const SETTLEMENTS = [...]; 

// ----------------------------------------------------------------------
// 1. ИНТЕГРАЦИЯ DADATA (Fetch API)
// ----------------------------------------------------------------------

const addressInput = document.getElementById('address');
const suggestionsList = document.getElementById('suggestionsList');

/**
 * Ручной обработчик ввода для Dadata
 */
addressInput.addEventListener('input', async () => {
    const query = addressInput.value.trim();
    if (query.length < 3) {
        suggestionsList.innerHTML = '';
        suggestionsList.classList.add('hidden');
        return;
    }

    try {
        const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Token ${DADATA_API_KEY}`,
            },
            
            // !!! ОБНОВЛЕННЫЙ БЛОК DADATA - ФИЛЬТР ПО СУРГУТСКОМУ РАЙОНУ С ДЕТАЛИЗАЦИЕЙ ДО КВАРТИРЫ !!!
            body: JSON.stringify({
                query,
                count: 5,
                // KLADR ID для Сургутского района (для приоритета)
                locations_boost: [{ kladr_id: "8601600000000" }], 
                
                // Ограничение по региону (ХМАО)
                locations: [{ 
                    region_type_full: "автономный округ", 
                    region: "Ханты-Мансийский Автономный Округ - Югра" 
                }],
                
                // Диапазон подсказок: от улицы до помещения (квартиры)
                from_bound: { value: 'street' },
                to_bound: { value: 'flat' } 
            })
            // !!! КОНЕЦ ОБНОВЛЕННОГО БЛОКА DADATA !!!

        });

        const data = await response.json();
        const suggestions = data.suggestions || [];

        suggestionsList.innerHTML = suggestions.map((item, index) => `
            <li class="suggestion-item" data-index="${index}" onclick="window.selectAddress(${index})">
                ${item.value}
            </li>
        `).join('');

        if (suggestions.length > 0) {
            suggestionsList.suggestionsData = suggestions; 
            suggestionsList.classList.remove('hidden');
        } else {
            suggestionsList.classList.add('hidden');
        }

    } catch (err) {
        console.error('Dadata error:', err);
        suggestionsList.classList.add('hidden');
    }
});

/**
 * Обработчик выбора адреса из списка
 */
window.selectAddress = (index) => {
    const selectedItem = suggestionsList.suggestionsData[index];
    if (selectedItem) {
        addressInput.value = selectedItem.value;
        
        // Сохраняем координаты Dadata
        if (selectedItem.data && selectedItem.data.geo_lat && selectedItem.data.geo_lon) {
            selectedSuggestionData = selectedItem.data;
            dadataCoords = {
                latitude: parseFloat(selectedItem.data.geo_lat),
                longitude: parseFloat(selectedItem.data.geo_lon)
            };
        } else {
            selectedSuggestionData = null;
            dadataCoords = null;
        }
    }
    suggestionsList.innerHTML = '';
    suggestionsList.classList.add('hidden');
    // Очищаем текущие GPS, чтобы избежать конфликта при сохранении
    document.getElementById('geolocation').value = ''; 
    currentLatitude = null;
    currentLongitude = null;
};

// Скрытие списка при потере фокуса 
document.addEventListener('click', (e) => {
    if (!addressInput.contains(e.target) && !suggestionsList.contains(e.target)) {
        suggestionsList.classList.add('hidden');
    }
});

// !!! ФУНКЦИЯ populateSettlements УДАЛЕНА !!!

// ----------------------------------------------------------------------
// 2. ГЕОЛОКАЦИЯ И СОХРАНЕНИЕ ДАННЫХ
// ----------------------------------------------------------------------

window.getGeolocation = function() {
    const geoStatus = document.getElementById('geoStatus');
    const geoInput = document.getElementById('geolocation');
    
    // Сброс координат Dadata
    dadataCoords = null; 
    selectedSuggestionData = null;
    addressInput.value = ''; // Очищаем поле Dadata
    
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

window.saveSurveyData = async function(event) {
    event.preventDefault();
    const saveStatus = document.getElementById('saveStatus');

    if (typeof db === 'undefined' || typeof userTelegramId === 'undefined') {
        window.showAlert('Ошибка', 'Приложение не подключено к базе данных или пользователь не авторизован.');
        return;
    }
    
    document.getElementById('saveButton').disabled = true;
    saveStatus.textContent = '⏳ Отправка...';

    // Приоритет: 1. GPS, 2. Dadata
    let finalLatitude = currentLatitude;
    let finalLongitude = currentLongitude;
    
    if (!finalLatitude && dadataCoords) {
        finalLatitude = dadataCoords.latitude;
        finalLongitude = dadataCoords.longitude;
    }

    // Извлекаем населенный пункт из Dadata для сохранения
    let finalSettlement = (selectedSuggestionData && selectedSuggestionData.settlement_with_type) || '';

    const data = {
        reporterId: userTelegramId, 
        timestamp: firebase.firestore.Timestamp.fromDate(new Date()), 
        
        // В качестве поселения теперь сохраняем то, что вернула Dadata
        settlement: finalSettlement, 
        address: document.getElementById('address').value,
        loyalty: document.getElementById('loyalty').value,
        action: document.getElementById('action').value, 
        comment: document.getElementById('comment').value || "",
        
        latitude: finalLatitude,
        longitude: finalLongitude
    };
    
    try {
        // Проверка заполнения полей
        if (!data.address || !data.loyalty || !data.action) {
             throw new Error("Не все обязательные поля заполнены.");
        }
        
        await db.collection("reports").add(data);
        window.showAlert('Успех', 'Данные успешно сохранены! Спасибо за работу.');
        
        // Сброс формы и переменных
        document.getElementById('surveyForm').reset();
        currentLatitude = null;
        currentLongitude = null;
        dadataCoords = null;
        selectedSuggestionData = null;
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
// 3. ЛОГИКА КАРТЫ 
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
// 4. ГЛАВНЫЙ БЛОК (Запуск после загрузки DOM)
// ----------------------------------------------------------------------

window.onload = async () => {
    
    // !!! populateSettlements УДАЛЕНА ИЗ-ЗА ИСПОЛЬЗОВАНИЯ DADATA !!!
    
    // !!! lucide.createIcons(); ЗАКОММЕНТИРОВАН, чтобы избежать ошибки CSP в Telegram !!!
    // lucide.createIcons(); 
    
    document.getElementById('saveButton').disabled = true;

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
};
