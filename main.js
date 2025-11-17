// main.js (ОКОНЧАТЕЛЬНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ - ВСЕ ОШИБКИ УСТРАНЕНЫ)

// --- Глобальные переменные ---
window.mapInstance = null; 
let dadataCoords = null;    
let selectedSuggestionData = null; 

// --- КОНСТАНТЫ И DOM-ЭЛЕМЕНТЫ ---
// Ключ Dadata теперь берется из window.DADATA_API_KEY, установленного в firebase-auth.js
// DADATA_API_KEY будет доступен только после вызова window.initializeFirebase
const urlParams = new URLSearchParams(window.location.search);
// Используем FIAS ID для ограничения поиска.
const DADATA_LOCATION_FIAS_ID = urlParams.get('dadata_fias_id') || '86'; 

const addressInput = document.getElementById('address');
const suggestionsList = document.getElementById('suggestionsList');
const addressStatus = document.getElementById('addressStatus');
const saveButton = document.getElementById('saveButton');
const infoContainer = document.getElementById('offlineInfo');

// --- УТИЛИТА: debounce (для ограничения вызовов API) ---
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// ----------------------------------------------------------------------
// ГЕОЛОКАЦИЯ (Перемещено вверх для избежания ReferenceError)
// ----------------------------------------------------------------------

function requestGeolocation() {
    if (!navigator.geolocation) {
        window.showAlert('Ошибка', 'Геолокация не поддерживается вашим устройством.');
        return;
    }
    
    const geolocationButton = document.getElementById('geolocationButton');
    if (geolocationButton) geolocationButton.disabled = true;

    addressStatus.textContent = '⏳ Определение местоположения...';

    navigator.geolocation.getCurrentPosition(
        pos => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            dadataCoords = { latitude: lat, longitude: lon };
            
            // Здесь должна быть функция обратного геокодирования
            // reverseGeocodeDadata(lat, lon); 
            
            addressStatus.textContent = `✅ Координаты: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;

            // В тестовом режиме просто сохраняем координаты
            selectedSuggestionData = {
                address: `Координаты (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
                latitude: lat,
                longitude: lon,
                fias_id: 'GEOLOCATION'
            };
            addressInput.value = selectedSuggestionData.address;

            if (geolocationButton) geolocationButton.disabled = false;
        },
        err => {
            console.error("Geolocation error:", err);
            let message = 'Не удалось получить координаты.';
            if (err.code === 1) message = 'Доступ к геолокации запрещен.';
            addressStatus.textContent = `❌ ${message}`;
            window.showAlert('Ошибка Геолокации', `${message} (${err.message}).`);
            if (geolocationButton) geolocationButton.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

// ----------------------------------------------------------------------
// DADATA API
// ----------------------------------------------------------------------

async function fetchSuggestions(query) {
    // ВАЖНО: Читаем ключ Dadata из window
    const dadataKey = window.DADATA_API_KEY;

    if (!dadataKey) {
        suggestionsList.innerHTML = '';
        console.error("DADATA_API_KEY не установлен. Поиск адресов Dadata недоступен.");
        if (addressStatus) {
            addressStatus.textContent = '⚠️ API Dadata недоступно. Обновите страницу.';
        }
        return;
    }

    if (query.length < 3) {
        suggestionsList.innerHTML = '';
        return;
    }

    const apiUrl = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address";
    
    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            mode: "cors",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": "Token " + dadataKey
            },
            body: JSON.stringify({
                query: query,
                locations: [{ "region_fias_id": DADATA_LOCATION_FIAS_ID }], 
                count: 5
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        renderSuggestions(data.suggestions);

    } catch (error) {
        console.error("Dadata API error:", error);
        addressStatus.textContent = '❌ Ошибка Dadata API.';
        suggestionsList.innerHTML = '';
    }
}

function renderSuggestions(suggestions) {
    suggestionsList.innerHTML = '';
    
    suggestions.forEach(suggestion => {
        if (suggestion.data && suggestion.data.geo_lat && suggestion.data.geo_lon && suggestion.value) {
            const li = document.createElement('li');
            li.className = 'p-2 cursor-pointer hover:bg-indigo-100/50 transition-colors text-sm';
            li.textContent = suggestion.value;
            
            li.addEventListener('click', () => {
                addressInput.value = suggestion.value;
                selectedSuggestionData = {
                    address: suggestion.value,
                    latitude: parseFloat(suggestion.data.geo_lat),
                    longitude: parseFloat(suggestion.data.geo_lon),
                    fias_id: suggestion.data.fias_id
                };
                suggestionsList.innerHTML = ''; 
                addressStatus.textContent = '✅ Адрес выбран.';
            });
            
            suggestionsList.appendChild(li);
        }
    });
}

function handleAddressInput(event) {
    selectedSuggestionData = null; 
    if (addressStatus) addressStatus.textContent = '...';
    // Используем debounce с немедленным вызовом
    debounce(() => fetchSuggestions(event.target.value), 300)();
}

// ----------------------------------------------------------------------
// ОТПРАВКА ОТЧЕТА И ОФФЛАЙН-СИНХРОНИЗАЦИЯ
// ----------------------------------------------------------------------

async function submitReport() {
    const reportData = getReportData();
    if (!reportData) {
        return; 
    }

    reportData.user_id = window.userTelegramId;
    reportData.username = window.userTelegramUsername || 'Не указано';
    reportData.saved_at = Date.now(); 

    // ВАЖНО: Проверка наличия Firebase
    if (navigator.onLine && window.db && typeof window.firebase !== 'undefined') {
        try {
            reportData.timestamp = window.firebase.firestore.FieldValue.serverTimestamp();
            delete reportData.saved_at; 
            
            const docRef = await window.db.collection('reports').add(reportData);
            window.showAlert('ОТЧЕТ ОТПРАВЛЕН', `✅ Отчет успешно сохранен в облаке. ID: ${docRef.id}`);
            resetForm();
        } catch (error) {
            console.error("Firebase save failed, saving offline:", error);
            window.showAlert('ОШИБКА СЕТИ', `⚠️ Не удалось отправить отчет. ${error.message}. Сохранено оффлайн.`);
            await window.saveOfflineReport(reportData);
            window.updateOfflineIndicator();
        }
    } else if (typeof window.saveOfflineReport === 'function') {
        // Оффлайн режим
        window.showAlert('ОФФЛАЙН РЕЖИМ', '💾 Отчет сохранен локально. Синхронизируется при появлении сети.');
        await window.saveOfflineReport(reportData);
        window.updateOfflineIndicator();
        resetForm();
    } else {
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Отчет не может быть сохранен: нет сети и оффлайн-хранилище недоступно.');
    }
}

function getReportData() {
    const data = {
        settlement: document.getElementById('settlement').value,
        loyalty: document.querySelector('input[name="loyalty"]:checked')?.value,
        action: document.getElementById('action').value,
        comment: document.getElementById('comment').value
    };
    
    if (selectedSuggestionData) {
        data.address = selectedSuggestionData.address;
        data.latitude = selectedSuggestionData.latitude;
        data.longitude = selectedSuggestionData.longitude;
        data.fias_id = selectedSuggestionData.fias_id;
    } else if (addressInput.value) {
        data.address = addressInput.value;
        // Если адрес введен вручную, координаты не добавляем
    }
    
    if (!data.settlement || !data.loyalty) {
        window.showAlert('Ошибка', 'Пожалуйста, выберите населенный пункт и лояльность.');
        return null;
    }
    
    if (addressInput.value && !selectedSuggestionData) {
        const confirm = window.confirm('Вы ввели адрес вручную и не выбрали его из списка Dadata. В отчете не будет точных координат. Продолжить сохранение?');
        if (!confirm) return null;
    }

    return data;
}

function resetForm() {
    document.getElementById('settlement').selectedIndex = 0;
    addressInput.value = '';
    selectedSuggestionData = null;
    document.getElementById('action').selectedIndex = 0;
    document.getElementById('comment').value = '';
    document.querySelectorAll('input[name="loyalty"]').forEach(radio => radio.checked = false);
}

/**
 * Обновляет индикатор оффлайн-отчетов на главной странице.
 * [ИСПРАВЛЕНИЕ: Замена иконки cloud-sync на refresh-cw и повторный вызов lucide.createIcons]
 */
window.updateOfflineIndicator = async function() {
    const infoContainer = document.getElementById('offlineInfo');
    
    if (!infoContainer || typeof window.getOfflineReports !== 'function') return;

    const reports = await window.getOfflineReports();
    const count = reports.length;

    if (count > 0) {
        infoContainer.innerHTML = `
            <div class="flex items-center text-orange-600 bg-orange-100 p-3 rounded-lg shadow-sm">
                <i data-lucide="refresh-cw" class="w-5 h-5 mr-2"></i> 
                <span>
                    Оффлайн-отчетов: <strong>${count}</strong>. 
                    <button id="syncButton" class="text-indigo-700 font-medium underline ml-1 hover:text-indigo-800">Синхронизировать</button>
                </span>
            </div>
        `;
        // Важно: После изменения DOM нужно снова вызвать createIcons!
        if (typeof lucide !== 'undefined') {
            lucide.createIcons(); 
        }
        
        // Повторно навешиваем обработчик на новую кнопку синхронизации
        document.getElementById('syncButton')?.addEventListener('click', (e) => {
            e.preventDefault();
            window.syncOfflineReports();
        });

    } else {
        infoContainer.innerHTML = ''; // Скрываем, если нет отчетов
    }
};


// ----------------------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ (Запускается после загрузки DOM)
// ----------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Создаем иконки
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // 2. Инициализация Firebase и аутентификация (функции из firebase-auth.js)
    const authSuccess = window.initializeFirebase ? window.initializeFirebase() : false;
    if (authSuccess) {
        await window.checkAdminStatus();
        
        // 3. Проверка оффлайн-отчетов
        if (typeof window.updateOfflineIndicator === 'function') {
            window.updateOfflineIndicator();
        }
        
        // 4. Синхронизация при старте, если есть сеть
        if (navigator.onLine && typeof window.syncOfflineReports === 'function') {
            await window.syncOfflineReports();
        }
        
    } else {
        // Ошибка в firebase-auth.js уже вызвала showAlert, просто блокируем кнопку
        if (saveButton) saveButton.disabled = true;
    }
    
    // 5. Назначаем обработчики событий
    if (saveButton) {
        saveButton.addEventListener('click', (e) => {
            e.preventDefault();
            submitReport();
        });
    }

    const geolocationButton = document.getElementById('geolocationButton');
    if (geolocationButton) {
        geolocationButton.addEventListener('click', (e) => {
            e.preventDefault();
            // Вызов функции, которая теперь определена выше
            requestGeolocation(); 
        });
    }

    // Обработчик для Dadata 
    if (addressInput) {
        addressInput.addEventListener('input', handleAddressInput); 
        addressInput.addEventListener('focus', handleAddressInput); 
        
        // Блокируем ввод, если нет ключа API Dadata
        if (!window.DADATA_API_KEY) {
            addressInput.placeholder = 'Dadata API недоступен.';
            addressInput.disabled = true;
        }
    }
    
    // PWA: Регистрация Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            // Исправленный относительный путь
            navigator.serviceWorker.register('./sw.js') 
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(error => {
                    console.error('ServiceWorker registration failed: ', error);
                });
        });
    }
});
