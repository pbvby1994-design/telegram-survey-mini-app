// main.js (ИСПРАВЛЕННАЯ ВЕРСИЯ)

// --- Глобальные переменные ---
let currentLatitude = null; 
let currentLongitude = null;
let dadataCoords = null;    
let selectedSuggestionData = null; 

const addressInput = document.getElementById('address');
const suggestionsList = document.getElementById('suggestionsList');

// ----------------------------------------------------------------------
// 1. ИНТЕГРАЦИЯ DADATA (Fetch API)
// ----------------------------------------------------------------------

/**
 * Ручной обработчик ввода для Dadata
 */
addressInput.addEventListener('input', async () => {
    // Используем window.DADATA_TOKEN
    if (typeof window.DADATA_TOKEN === 'undefined' || !window.DADATA_TOKEN) {
        // Не показываем showAlert на каждый ввод, если токена нет
        document.getElementById('addressError').textContent = '⚠️ Токен Dadata не загружен.';
        document.getElementById('addressError').style.display = 'block';
        return;
    }
    
    const query = addressInput.value.trim();
    if (query.length < 3) {
        suggestionsList.innerHTML = '';
        suggestionsList.classList.add('hidden');
        return;
    }

    // Сброс выбранных данных при вводе
    selectedSuggestionData = null; 
    dadataCoords = null; 

    try {
        const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Token ${window.DADATA_TOKEN}`, 
            },
            body: JSON.stringify({
                query: query,
                locations: window.DADATA_LOCATION_RESTRICTIONS || [], 
            }),
        });
        
        if (!response.ok) {
            // КОД 401: Unauthorized - Проверьте публичный ключ Dadata!
            throw new Error(`Dadata API error: ${response.status} (${response.statusText})`);
        }

        const data = await response.json();
        
        suggestionsList.innerHTML = '';
        suggestionsList.classList.remove('hidden');

        data.suggestions.slice(0, 5).forEach(suggestion => {
            const li = document.createElement('li');
            li.textContent = suggestion.value;
            li.className = 'p-2 cursor-pointer hover:bg-indigo-100 border-b border-gray-100';
            li.onclick = () => selectSuggestion(suggestion);
            suggestionsList.appendChild(li);
        });

        if (data.suggestions.length === 0) {
            suggestionsList.classList.add('hidden');
        } else {
            document.getElementById('addressError').style.display = 'none'; // Скрываем ошибку, если есть подсказки
        }

    } catch (error) {
        console.error('Ошибка Dadata:', error);
        suggestionsList.classList.add('hidden');
        document.getElementById('addressError').textContent = `⚠️ Ошибка Dadata: ${error.message}.`;
        document.getElementById('addressError').style.display = 'block';
    }
});

/**
 * Выбор адреса из списка подсказок
 */
function selectSuggestion(suggestion) {
    addressInput.value = suggestion.value;
    suggestionsList.classList.add('hidden');
    selectedSuggestionData = suggestion; 
    
    dadataCoords = {
        latitude: parseFloat(suggestion.data.geo_lat),
        longitude: parseFloat(suggestion.data.geo_lon)
    };
    document.getElementById('addressError').style.display = 'none';
}


// ----------------------------------------------------------------------
// 2. ГЕОЛОКАЦИЯ
// ----------------------------------------------------------------------

window.getCurrentLocation = function() {
    const geoStatus = document.getElementById('geoStatus');
    const geoIcon = document.getElementById('geoIcon');
    
    geoStatus.textContent = 'Геолокация: ⏳ Определение...';
    geoIcon.setAttribute('data-lucide', 'loader'); 
    lucide.createIcons();
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLatitude = position.coords.latitude;
                currentLongitude = position.coords.longitude;
                geoStatus.textContent = `Геолокация: ✅ Получено (${currentLatitude.toFixed(4)}, ${currentLongitude.toFixed(4)})`;
                geoIcon.setAttribute('data-lucide', 'check-circle'); 
                lucide.createIcons();
            },
            (error) => {
                console.error("Geolocation error:", error);
                geoStatus.textContent = 'Геолокация: ❌ Отказано в доступе или ошибка.';
                geoIcon.setAttribute('data-lucide', 'x-circle'); 
                currentLatitude = null;
                currentLongitude = null;
                lucide.createIcons();
                window.showAlert('Геолокация', 'Не удалось получить GPS-координаты. Проверьте разрешения.');
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    } else {
        geoStatus.textContent = 'Геолокация: ❌ Не поддерживается.';
        geoIcon.setAttribute('data-lucide', 'alert-triangle');
        lucide.createIcons();
        window.showAlert('Геолокация', 'Ваш браузер не поддерживает API геолокации.');
    }
}


// ----------------------------------------------------------------------
// 3. СОХРАНЕНИЕ ОТЧЕТА В FIRESTORE
// ----------------------------------------------------------------------

window.saveReport = async function() {
    if (!window.db) {
        window.showAlert('ОШИБКА FIRESTORE', 'Соединение с базой данных не установлено.');
        return;
    }
    
    // --- УСИЛЕННАЯ ВАЛИДАЦИЯ ---
    if (!selectedSuggestionData || addressInput.value !== selectedSuggestionData.value) {
        document.getElementById('addressError').textContent = '⚠️ Выберите адрес из списка Dadata!';
        document.getElementById('addressError').style.display = 'block';
        window.showAlert('Ошибка формы', 'Необходимо выбрать корректный адрес из списка подсказок.');
        return;
    }
    
    // Проверка, что Dadata вернула координаты
    if (!dadataCoords || !dadataCoords.latitude || !dadataCoords.longitude) {
         window.showAlert('Ошибка формы', 'Выбранный адрес Dadata не содержит географических координат. Выберите другой адрес.');
         return;
    }

    const form = document.getElementById('reportForm');
    const formData = new FormData(form);
    
    // Проверка, что поля Лояльность и Действие выбраны
    if (!formData.get('loyalty') || !formData.get('action')) {
        window.showAlert('Ошибка формы', 'Поля "Лояльность" и "Действие" обязательны для заполнения.');
        return;
    }
    // ----------------------------

    const reportData = {
        telegramId: window.userTelegramId || 'unknown_user',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        settlement: formData.get('settlement'),
        address: selectedSuggestionData.value, 
        
        // Координаты Dadata (для отображения на карте)
        latitude: dadataCoords.latitude,
        longitude: dadataCoords.longitude,

        // Координаты GPS пользователя (если получены)
        geo_lat_user: currentLatitude,
        geo_lon_user: currentLongitude,
        
        loyalty: formData.get('loyalty'),
        action: formData.get('action'),
        comment: formData.get('comment')
    };

    try {
        const docRef = await window.db.collection("reports").add(reportData);
        
        // Сброс формы и статусов
        form.reset();
        currentLatitude = null;
        currentLongitude = null;
        selectedSuggestionData = null;
        dadataCoords = null;
        document.getElementById('geoStatus').textContent = 'Геолокация: ❓ Не получена';
        document.getElementById('geoIcon').setAttribute('data-lucide', 'map-pin');
        document.getElementById('addressError').style.display = 'none';
        lucide.createIcons();
        
        // Повторный запрос GPS после сброса (для следующего отчета)
        window.getCurrentLocation(); 

        window.showAlert('УСПЕХ', 'Отчет успешно сохранен в базу данных.');
        
        if (window.Telegram.WebApp) {
            window.Telegram.WebApp.sendData(JSON.stringify({ status: 'success', docId: docRef.id }));
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        
    } catch (e) {
        console.error("Error adding document: ", e);
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', `Не удалось сохранить отчет: ${e.message}. Проверьте правила записи Firestore.`);
        if (window.Telegram.WebApp) window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
    }
}


// ----------------------------------------------------------------------
// 4. ИНИЦИАЛИЗАЦИЯ ДАШБОРДА (admin_dashboard.html)
// ----------------------------------------------------------------------

window.loadDashboard = async function() {
    // 1. Инициализация Telegram WebApp
    if (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp.ready) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
    }
    
    const saveButton = document.getElementById('saveButton');
    if (saveButton) saveButton.disabled = true;

    if (!window.initializeFirebase()) {
         window.showSection('form-view');
         return;
    }

    const isAuthenticated = await window.authenticateUser();
    
    // Автоматический запрос GPS, если это форма
    if (document.getElementById('form-view')) {
         window.getCurrentLocation();
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const initialView = urlParams.get('view');
    let startSection = 'form-view'; // По умолчанию - форма

    if (isAuthenticated) {
         // 2. Настройка админских вкладок
         if (window.isAdmin) {
             document.getElementById('btn-map-view').classList.remove('hidden');
             document.getElementById('btn-stats').classList.remove('hidden');
             document.getElementById('btn-raw-data').classList.remove('hidden');
         }
         
         // 3. Выбор начального раздела
         if (window.isAdmin && (initialView === 'map-view' || initialView === 'map')) {
             startSection = 'map-view';
         }

         window.showSection(startSection);
         if (saveButton) saveButton.disabled = false;
         
    } else {
         window.showSection('form-view');
         if (saveButton) saveButton.disabled = true;
         // Аутентификация не удалась, показываем форму, но сохранение запрещено
    }
}
