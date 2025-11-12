// main.js (ОБНОВЛЕННАЯ ВЕРСИЯ С DADATA И FIREBASE V9 COMPAT)

// --- Глобальные переменные ---
window.mapInstance = null; 
let currentLatitude = null; 
let currentLongitude = null;
let dadataCoords = null;    
let selectedSuggestionData = null; 

// ----------------------------------------------------------------------
// 1. ИНТЕГРАЦИЯ DADATA (Fetch API)
// ----------------------------------------------------------------------

const addressInput = document.getElementById('address');
const suggestionsList = document.getElementById('suggestionsList');

/**
 * Ручной обработчик ввода для Dadata
 */
addressInput.addEventListener('input', async () => {
    // Проверка наличия токена
    if (!window.dadataToken) {
        addressInput.placeholder = "Ошибка: Dadata Token отсутствует!";
        suggestionsList.classList.add('hidden');
        return;
    }

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
                'Authorization': `Token ${window.dadataToken}`, // !!! ИСПОЛЬЗУЕМ ТОКЕН ИЗ URL !!!
            },
            
            // ФИЛЬТР: Сургутский район + Детализация до квартиры
            body: JSON.stringify({
                query,
                count: 5,
                locations_boost: [{ kladr_id: "8601600000000" }], 
                locations: [{ 
                    region_type_full: "автономный округ", 
                    region: "Ханты-Мансийский Автономный Округ - Югра" 
                }],
                from_bound: { value: 'street' },
                to_bound: { value: 'flat' } 
            })

        });
        
        if (!response.ok) {
            throw new Error(`Dadata API returned status ${response.status}`);
        }

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
        window.showAlert('Ошибка Dadata', `Не удалось получить подсказки: ${err.message}. Проверьте токен.`);
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

// ----------------------------------------------------------------------
// 2. ГЕОЛОКАЦИЯ И СОХРАНЕНИЕ ДАННЫХ
// ----------------------------------------------------------------------

/**
 * Получает GPS координаты. Не сбрасывает Dadata адрес.
 */
window.getGeolocation = function() {
    const geoStatus = document.getElementById('geoStatus');
    const geoInput = document.getElementById('geolocation');
    
    currentLatitude = null;
    currentLongitude = null;
    geoInput.value = ''; 
    
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
            },
            (error) => {
                currentLatitude = null;
                currentLongitude = null;
                geoInput.value = 'Нет данных';
                geoStatus.textContent = '❌ Ошибка GPS';
                geoStatus.classList.add('text-red-500');
                window.showAlert('Ошибка GPS', 'Не удалось получить местоположение. Убедитесь, что разрешили доступ и используете HTTPS.');
            },
            { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
        );
    } else {
        geoStatus.textContent = '❌ Не поддерживается';
        window.showAlert('Ошибка', 'Геолокация не поддерживается вашим устройством.');
    }
}

/**
 * Сохранение данных в Firestore (v9 Compat API)
 */
window.saveSurveyData = async function(event) {
    event.preventDefault();
    const saveStatus = document.getElementById('saveStatus');

    if (!window.db || !window.userTelegramId) {
        window.showAlert('Ошибка', 'Приложение не подключено к базе данных или пользователь не авторизован.');
        return;
    }
    
    document.getElementById('saveButton').disabled = true;
    saveStatus.textContent = '⏳ Отправка...';

    // --- КЛИЕНТСКАЯ ВАЛИДАЦИЯ ---
    const address = document.getElementById('address').value.trim();
    const loyalty = document.getElementById('loyalty').value;
    const action = document.getElementById('action').value;

    if (!address || !loyalty || !action) {
        window.showAlert('Ошибка', 'Пожалуйста, заполните все обязательные поля (Адрес, Лояльность, Действие).');
        document.getElementById('saveButton').disabled = false;
        saveStatus.textContent = 'Готов';
        return;
    }

    // Приоритет: 1. GPS, 2. Dadata
    let finalLatitude = currentLatitude;
    let finalLongitude = currentLongitude;
    
    if (!finalLatitude && dadataCoords) {
        finalLatitude = dadataCoords.latitude;
        finalLongitude = dadataCoords.longitude;
    }

    let finalSettlement = (selectedSuggestionData && selectedSuggestionData.settlement_with_type) || '';

    const data = {
        reporterId: window.userTelegramId, 
        timestamp: firebase.firestore.Timestamp.fromDate(new Date()), // v9 Compat
        
        settlement: finalSettlement, 
        address: address,
        loyalty: loyalty,
        action: action, 
        comment: document.getElementById('comment').value || "",
        
        latitude: finalLatitude || null,
        longitude: finalLongitude || null
    };
    
    try {
        // v9 Compat: db.collection("reports").add(data);
        await window.db.collection("reports").add(data); 
        
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
// 3. ЛОГИКА КАРТЫ И ОТЧЕТОВ
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
    if (!window.db || !window.mapInstance) return;
    
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
        
        // v9 Compat: db.collection("reports").orderBy("timestamp", "desc").get();
        const snapshot = await window.db.collection("reports").orderBy("timestamp", "desc").get();
        const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // ... (остальной код карты без изменений) ...

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
                    <strong>${r.settlement || 'N/A'}</strong>, ${r.address}<br>
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
        document.getElementById('map-loading-status').textContent = 'Ошибка загрузки данных.';
    }
}

/**
 * Загрузка отчетов в таблицу (v9 Compat API)
 */
async function fetchAndLoadReportsTable() {
    if (!window.db) return;
    
    const statusEl = document.getElementById('reports-loading-status');
    const tableEl = document.getElementById('reportsTable');
    
    statusEl.textContent = 'Загрузка данных...';
    statusEl.classList.remove('hidden');
    tableEl.classList.add('hidden');
    
    try {
        // v9 Compat: db.collection("reports").orderBy("timestamp", "desc").get();
        const snapshot = await window.db.collection("reports").orderBy("timestamp", "desc").get();
        const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (reports.length === 0) {
            statusEl.textContent = 'Отчетов не найдено.';
            return;
        }
        
        // ... (остальной код генерации таблицы без изменений) ...

        const loyaltyMap = {
            'strong': 'ДА', 'moderate': 'СКОРЕЕ ДА',
            'neutral': 'НЕ ЗНАЮ', 'against': 'НЕТ'
        };

        let html = `
            <thead>
                <tr class="text-left">
                    <th class="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                    <th class="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Поселение</th>
                    <th class="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Адрес</th>
                    <th class="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Лояльность</th>
                    <th class="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Действие</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
        `;
        
        reports.forEach(r => {
            const date = r.timestamp ? new Date(r.timestamp.toDate()).toLocaleDateString('ru-RU') : 'N/A';
            const time = r.timestamp ? new Date(r.timestamp.toDate()).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
            const loyaltyText = loyaltyMap[r.loyalty] || r.loyalty;
            
            html += `
                <tr>
                    <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${date}<br><span class="text-xs text-gray-500">${time}</span></td>
                    <td class="px-4 py-2 text-sm text-gray-700">${r.settlement || 'N/A'}</td>
                    <td class="px-4 py-2 text-sm text-gray-700">${r.address}</td>
                    <td class="px-4 py-2 whitespace-nowrap text-sm font-semibold">${loyaltyText}</td>
                    <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-700">${r.action || 'N/A'}</td>
                </tr>
            `;
        });
        
        html += `</tbody>`;
        
        tableEl.innerHTML = html;
        statusEl.classList.add('hidden');
        tableEl.classList.remove('hidden');

    } catch (e) {
        console.error("Ошибка загрузки отчетов:", e);
        statusEl.textContent = `Ошибка загрузки данных: ${e.message}`;
        window.showAlert('Ошибка', 'Не удалось загрузить таблицу отчетов.');
    }
}


window.showSection = function(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(sectionId).classList.remove('hidden');

    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    const sectionButton = document.getElementById(`btn-${sectionId}`);
    if (sectionButton) {
        sectionButton.classList.add('active');
    }

    if (sectionId === 'map-view' && window.isAdmin) {
         if (typeof ymaps !== 'undefined') {
             if (!window.mapInstance) {
                window.initMap(); 
             } else {
                fetchAndLoadReportsToMap();
             }
         }
    }
    
    if (sectionId === 'reports-list' && window.isAdmin) {
        fetchAndLoadReportsTable();
    }
}


// ----------------------------------------------------------------------
// 4. ГЛАВНЫЙ БЛОК (Запуск после загрузки DOM)
// ----------------------------------------------------------------------

window.onload = async () => {
    
    // Скрываем экран загрузки в конце
    const loadingScreen = document.getElementById('loadingScreen');
    const mainHeader = document.getElementById('mainHeader');
    const mainContent = document.getElementById('mainContent');
    
    // !!! Lucide закомментирован, чтобы избежать ошибки CSP в Telegram !!!
    // lucide.createIcons(); 
    
    document.getElementById('saveButton').disabled = true;

    if (!initializeFirebase()) {
         loadingScreen.style.display = 'none';
         mainHeader.classList.remove('hidden');
         mainContent.classList.remove('hidden');
         window.showSection('form');
         return;
    }

    const isAuthenticated = await authenticateUser();
    
    if (isAuthenticated) {
         let startSection = 'form'; 
         const urlParams = new URLSearchParams(window.location.search);
         const initialView = urlParams.get('view');
         
         if (window.isAdmin) {
             document.getElementById('btn-map-view').style.display = 'inline-block';
             document.getElementById('btn-reports-list').style.display = 'inline-block';

             if (initialView === 'map-view') {
                 startSection = 'map-view';
             } else if (initialView === 'reports-list') {
                 startSection = 'reports-list';
             }
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
    
    // Показываем контент
    loadingScreen.style.display = 'none';
    mainHeader.classList.remove('hidden');
    mainContent.classList.remove('hidden');
};
