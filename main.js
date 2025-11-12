// main.js (ВЕРСИЯ С DADATA FETCH API и УЛУЧШЕННЫМ UX/UI)

// --- Глобальные переменные ---
let currentLatitude = null; 
let currentLongitude = null;
let dadataCoords = null;    

// --- КОНФИГУРАЦИЯ DADATA (Получение из config.js) ---
const DADATA_TOKEN = window.DADATA_TOKEN; 
const DADATA_LOCATION_RESTRICTIONS = window.DADATA_LOCATION_RESTRICTIONS;
let selectedSuggestionData = null; 

const addressInput = document.getElementById('address');
const suggestionsList = document.getElementById('suggestionsList');
const saveButton = document.getElementById('saveButton'); // Кнопка из HTML
const reportForm = document.getElementById('reportForm');

// ----------------------------------------------------------------------
// 1. ИНТЕГРАЦИЯ DADATA (Fetch API)
// ----------------------------------------------------------------------

/**
 * Ручной обработчик ввода для Dadata
 */
addressInput.addEventListener('input', async () => {
    const query = addressInput.value.trim();
    suggestionsList.innerHTML = '';
    selectedSuggestionData = null; // Сбрасываем при вводе
    
    if (query.length < 3) {
        suggestionsList.classList.add('hidden');
        return;
    }

    // --- УЛУЧШЕНИЕ: ИНДИКАТОР ЗАГРУЗКИ ---
    addressInput.classList.add('loading-spinner');

    try {
        const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Token ${DADATA_TOKEN}`
            },
            body: JSON.stringify({ 
                query: query,
                locations: DADATA_LOCATION_RESTRICTIONS, 
                count: 10
            })
        });

        if (!response.ok) {
            throw new Error(`Dadata API error: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.suggestions && data.suggestions.length > 0) {
            suggestionsList.classList.remove('hidden');
            data.suggestions.forEach(suggestion => {
                const li = document.createElement('li');
                li.className = 'p-3 hover:bg-indigo-50 cursor-pointer';
                li.textContent = suggestion.value;
                li.addEventListener('click', () => {
                    addressInput.value = suggestion.value;
                    selectedSuggestionData = suggestion.data; // Сохраняем выбранные данные Dadata
                    dadataCoords = { 
                        latitude: parseFloat(suggestion.data.geo_lat), 
                        longitude: parseFloat(suggestion.data.geo_lon) 
                    };
                    suggestionsList.innerHTML = '';
                    suggestionsList.classList.add('hidden');
                });
                suggestionsList.appendChild(li);
            });
        } else {
            suggestionsList.classList.add('hidden');
        }

    } catch (error) {
        console.error('Dadata lookup failed:', error);
        suggestionsList.classList.add('hidden'); 
    } finally {
        // Убрано: addressInput.classList.remove('loading-spinner'); (нужно реализовать CSS-класс)
    }
});

// Скрытие списка при потере фокуса
addressInput.addEventListener('blur', () => {
    setTimeout(() => {
        suggestionsList.classList.add('hidden');
    }, 200); 
});

addressInput.addEventListener('focus', () => {
    if (suggestionsList.innerHTML !== '') {
        suggestionsList.classList.remove('hidden');
    }
});


// ----------------------------------------------------------------------
// 2. ГЕОЛОКАЦИЯ
// ----------------------------------------------------------------------

/**
 * Получает текущую геолокацию пользователя (Fallbacks на браузерный API).
 */
window.getCurrentLocation = function() {
    
    if (!navigator.geolocation) {
        window.showAlert('ОШИБКА', 'Ваш браузер не поддерживает геолокацию или она отключена.');
        document.getElementById('geoStatus').textContent = 'Геолокация: ❌ Не поддерживается';
        return;
    }
    
    // --- ИНДИКАТОР ЗАГРУЗКИ ---
    const geoIcon = document.getElementById('geoIcon');
    geoIcon.innerHTML = `<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                           <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                           <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>`;
    
    // Временно отключаем кнопку сохранения
    if (window.Telegram.WebApp && window.Telegram.WebApp.MainButton.isVisible) {
         window.Telegram.WebApp.MainButton.showProgress();
    } else if (saveButton) {
        saveButton.disabled = true;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentLatitude = position.coords.latitude;
            currentLongitude = position.coords.longitude;
            window.showAlert('УСПЕХ', `Геолокация получена: ${currentLatitude.toFixed(4)}, ${currentLongitude.toFixed(4)}`);
            document.getElementById('geoStatus').textContent = 'Геолокация: ✅ ОК';
        },
        (error) => {
            console.error("Geolocation error:", error);
            window.showAlert('ОШИБКА ГЕОЛОКАЦИИ', `Не удалось получить координаты: ${error.message}`);
            document.getElementById('geoStatus').textContent = 'Геолокация: ❌ Ошибка';
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    ).finally(() => {
        // Восстановление кнопки
        geoIcon.innerHTML = `<span data-lucide="map-pin" class="w-5 h-5"></span>`;
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        
        if (window.Telegram.WebApp && window.Telegram.WebApp.MainButton.isVisible) {
             window.Telegram.WebApp.MainButton.hideProgress();
        } else if (saveButton) {
            saveButton.disabled = false;
        }
    });
}

// ----------------------------------------------------------------------
// 3. ОТПРАВКА ДАННЫХ В FIRESTORE
// ----------------------------------------------------------------------

/**
 * Валидация формы перед отправкой
 */
function validateForm() {
    const settlement = document.getElementById('settlement').value;
    const address = addressInput.value.trim();
    const loyalty = document.querySelector('input[name="loyalty"]:checked');
    const action = document.querySelector('input[name="action"]:checked');
    
    if (!settlement || !address || !loyalty || !action) {
        window.showAlert('ОШИБКА ВАЛИДАЦИИ', 'Пожалуйста, заполните все обязательные поля (НП, Адрес, Лояльность, Действие).');
        return false;
    }
    
    if (selectedSuggestionData === null) {
        window.showAlert('ОШИБКА АДРЕСА', 'Пожалуйста, выберите адрес из выпадающего списка Dadata для обеспечения точности данных.');
        return false;
    }
    
    return true;
}


/**
 * Обработчик кнопки сохранения
 */
window.saveReport = async function() {
    if (!validateForm() || !window.db) {
        if (window.Telegram.WebApp) window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        return;
    }

    // --- ИНДИКАТОР ЗАГРУЗКИ ---
    if (window.Telegram.WebApp) {
        window.Telegram.WebApp.MainButton.showProgress();
    } else if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerHTML = `<svg class="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                             </svg> Сохранение...`;
    }
    
    // --- ПРИГОТОВЛЕНИЕ ДАННЫХ ---
    const reportData = {
        telegramId: window.userTelegramId,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        settlement: document.getElementById('settlement').value,
        address: addressInput.value.trim(),
        loyalty: document.querySelector('input[name="loyalty"]:checked').value,
        action: document.querySelector('input[name="action"]:checked').value,
        comment: document.getElementById('comment').value.trim(),
        
        latitude: dadataCoords ? dadataCoords.latitude : null,
        longitude: dadataCoords ? dadataCoords.longitude : null,
        
        geo_lat_user: currentLatitude,
        geo_lon_user: currentLongitude,
    };

    try {
        await window.db.collection('reports').add(reportData);

        // --- УСПЕХ ---
        if (window.Telegram.WebApp) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        window.showAlert('УСПЕХ', 'Отчет успешно сохранен!');
        
        // Очистка формы
        reportForm.reset();
        selectedSuggestionData = null;
        currentLatitude = null;
        currentLongitude = null;
        dadataCoords = null;
        document.getElementById('geoStatus').textContent = 'Геолокация: ❓ Не получена';
        
    } catch (error) {
        // --- ОШИБКА ---
        if (window.Telegram.WebApp) window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        console.error("Ошибка сохранения отчета:", error);
        window.showAlert('ОШИБКА СОХРАНЕНИЯ', `Не удалось сохранить отчет: ${error.message}`);
        
    } finally {
        // --- ВОССТАНОВЛЕНИЕ КНОПКИ ---
        if (window.Telegram.WebApp) {
             window.Telegram.WebApp.MainButton.hideProgress();
        } else if (saveButton) {
            saveButton.innerHTML = `<span data-lucide="save" class="w-5 h-5 mr-2"></span> Сохранить Отчет`;
            saveButton.disabled = false;
            if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        }
    }
}


// ----------------------------------------------------------------------
// 4. ИНИЦИАЛИЗАЦИЯ
// ----------------------------------------------------------------------

window.loadDashboard = async function() {
    // 1. Инициализация Telegram Web App
    if (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp.ready) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        window.Telegram.WebApp.setHeaderColor('bg_color');
        window.Telegram.WebApp.setBackgroundColor('bg_color');
        
        // --- UX УЛУЧШЕНИЕ: Главная кнопка Telegram ---
        window.Telegram.WebApp.MainButton.setText("СОХРАНИТЬ ОТЧЕТ");
        window.Telegram.WebApp.MainButton.show();
        // Отключаем нативную кнопку в HTML и используем кнопку Telegram
        document.getElementById('saveButton').style.display = 'none'; 
        window.Telegram.WebApp.MainButton.onClick(window.saveReport);
    }

    // 2. Инициализация Firebase и Аутентификация
    if (!window.initializeFirebase()) {
         window.showSection('form');
         return;
    }

    const isAuthenticated = await window.authenticateUser();
    
    if (isAuthenticated) {
         if (window.isAdmin) {
             // Админ: показать админку и скрыть кнопку сохранения
             window.Telegram.WebApp.MainButton.hide();
             
             // Логика переключения на карту, если это стартовая секция
             const urlParams = new URLSearchParams(window.location.search);
             const initialView = urlParams.get('view');
             const startSection = (initialView === 'map-view' || !initialView) ? 'map-view' : 'form';
             
             if (startSection === 'map-view') {
                 window.showSection('map-view');
             } else {
                 window.showSection('form');
                 window.Telegram.WebApp.MainButton.show();
             }

             // Показать все вкладки для админа
             document.getElementById('btn-map-view').style.display = 'inline-flex';
             document.getElementById('btn-stats').style.display = 'inline-flex';
             document.getElementById('btn-raw-data').style.display = 'inline-flex';
             
         } else {
             // Пользователь: только форма
             window.showSection('form');
             window.Telegram.WebApp.MainButton.show();
         }
         
    } else {
         // Не аутентифицирован или крит. ошибка
         window.showSection('form');
         window.Telegram.WebApp.MainButton.hide();
    }
}
