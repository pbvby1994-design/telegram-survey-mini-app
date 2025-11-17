// main.js (ФИНАЛЬНАЯ ВЕРСИЯ С АНИМАЦИЯМИ, PWA ОФФЛАЙН ЛОГИКОЙ И УСИЛЕННЫМ TRY-CATCH)

// --- Глобальные переменные ---
window.mapInstance = null; 
let dadataCoords = null;    

// --- КОНФИГУРАЦИЯ DADATA (Из глобальной переменной window.DADATA_API_KEY) ---
// Ключ Dadata теперь берется из window.DADATA_API_KEY, установленного в firebase-auth.js
const DADATA_API_KEY = window.DADATA_API_KEY; 

// Используем FIAS ID для ограничения поиска (дефолтное значение '86' для ХМАО).
// Этот параметр остается в URL, так как не является конфиденциальным ключом.
const urlParams = new URLSearchParams(window.location.search);
const DADATA_LOCATION_FIAS_ID = urlParams.get('dadata_fias_id') || '86'; 

let selectedSuggestionData = null; 

const addressInput = document.getElementById('address');
const suggestionsList = document.getElementById('suggestionsList');
const addressStatus = document.getElementById('addressStatus');
const saveButton = document.getElementById('saveButton');
const infoContainer = document.getElementById('offlineInfo');

/**
 * Ручной обработчик ввода для Dadata
 */
if (addressInput) {
    // ВАЖНО: Проверяем DADATA_API_KEY, который установлен в firebase-auth.js
    if (!DADATA_API_KEY) {
        console.error("DADATA_API_KEY не найден в глобальной конфигурации. Поиск адресов Dadata будет недоступен.");
        if (addressStatus) {
            addressStatus.textContent = '⚠️ API Dadata недоступно. Обратитесь к администратору.';
            addressInput.setAttribute('disabled', 'true');
        }
    } else {
        if (addressStatus) {
            addressStatus.textContent = 'Введите адрес...';
        }
    }

    let debounceTimer;
    addressInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            fetchSuggestions(addressInput.value);
        }, 300);
    });

    // Скрываем список при потере фокуса, но даем время на клик по предложению
    addressInput.addEventListener('blur', () => {
        setTimeout(() => {
            if (suggestionsList) suggestionsList.classList.add('hidden');
        }, 150);
    });
    addressInput.addEventListener('focus', () => {
        if (suggestionsList && suggestionsList.childElementCount > 0) {
            suggestionsList.classList.remove('hidden');
        }
    });
}

/**
 * Получает предложения по адресу от Dadata.
 * @param {string} query Введенный пользователем адрес.
 */
async function fetchSuggestions(query) {
    if (!query || query.length < 3 || !DADATA_API_KEY) {
        if (suggestionsList) suggestionsList.classList.add('hidden');
        return;
    }

    try {
        const response = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address", {
            method: "POST",
            mode: "cors",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": "Token " + DADATA_API_KEY 
            },
            body: JSON.stringify({
                query: query,
                // Ограничение по региону (ХМАО)
                locations: [{ fias_region_code: DADATA_LOCATION_FIAS_ID }],
                count: 5 
            })
        });

        if (!response.ok) {
            throw new Error(`Dadata API error: ${response.status}`);
        }

        const data = await response.json();
        
        suggestionsList.innerHTML = '';
        if (data.suggestions && data.suggestions.length > 0) {
            data.suggestions.forEach(suggestion => {
                const li = document.createElement('li');
                li.className = 'p-3 cursor-pointer hover:bg-indigo-100 transition duration-150 border-b last:border-b-0';
                li.textContent = suggestion.value;
                li.addEventListener('mousedown', (e) => { // Используем mousedown, чтобы событие сработало до blur
                    e.preventDefault();
                    selectSuggestion(suggestion);
                });
                suggestionsList.appendChild(li);
            });
            suggestionsList.classList.remove('hidden');
        } else {
            suggestionsList.classList.add('hidden');
        }

    } catch (error) {
        console.error("Error fetching Dadata suggestions:", error);
        addressStatus.textContent = '❌ Ошибка Dadata API.';
        suggestionsList.classList.add('hidden');
    }
}

/**
 * Выбирает предложение адреса и сохраняет его данные.
 * @param {Object} suggestion Данные предложения от Dadata.
 */
function selectSuggestion(suggestion) {
    selectedSuggestionData = suggestion.data;
    addressInput.value = suggestion.value;
    suggestionsList.classList.add('hidden');
    addressStatus.textContent = '✅ Адрес выбран.';
    
    // Сохраняем координаты Dadata для отчета
    dadataCoords = {
        latitude: parseFloat(suggestion.data.geo_lat),
        longitude: parseFloat(suggestion.data.geo_lon)
    };
    
    // Очищаем поле геолокации, чтобы не дублировать, если она была запрошена
    document.getElementById('geolocationInfo').textContent = '—';
}

/**
 * Отправляет отчет в Firebase или сохраняет его оффлайн.
 */
async function submitReport() {
    const settlement = document.getElementById('settlement').value;
    const address = addressInput.value.trim();
    const loyalty = document.querySelector('input[name="loyalty"]:checked')?.value;
    const action = document.getElementById('action').value;
    const comment = document.getElementById('comment').value.trim();
    
    if (!settlement || !address || !loyalty || !action) {
        window.showAlert('Ошибка', 'Пожалуйста, заполните все обязательные поля (Поселение, Адрес, Лояльность, Действие).');
        return;
    }
    
    // Собираем координаты: сначала геолокация, затем Dadata
    const latitude = document.getElementById('geolocationInfo').dataset.lat || dadataCoords?.latitude || null;
    const longitude = document.getElementById('geolocationInfo').dataset.lon || dadataCoords?.longitude || null;

    const reportData = {
        telegram_id: window.userTelegramId,
        telegram_username: window.userTelegramUsername,
        settlement,
        address,
        loyalty,
        action,
        comment: comment || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        source: 'agitator-app',
        // timestamp будет заполнен на сервере Firebase, если отчет отправляется онлайн
    };
    
    // Блокируем кнопку, чтобы избежать двойной отправки
    saveButton.disabled = true;
    saveButton.innerHTML = `<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> Отправка...`;
    lucide.createIcons();
    
    try {
        // 1. Попытка отправить в Firebase
        await window.db.collection('reports').add({
            ...reportData,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        window.showAlert('Успех', '✅ Отчет успешно отправлен в Firebase.');
        resetForm();

    } catch (firebaseError) {
        console.warn("Firebase недоступен. Сохранение оффлайн...", firebaseError);
        
        // 2. Если Firebase недоступен, сохраняем в IndexedDB
        try {
            // Добавляем служебное поле для сортировки оффлайн-отчетов
            reportData.saved_at = Date.now();
            await window.saveOfflineReport(reportData);
            
            window.showAlert('Оффлайн-режим', '⚠️ Соединение отсутствует. Отчет сохранен локально и будет отправлен позже.');
            updateOfflineIndicator();
            resetForm();
            
        } catch (dbError) {
            console.error("Критическая ошибка сохранения в IndexedDB:", dbError);
            window.showAlert('Критическая Ошибка', 'Не удалось сохранить отчет даже в оффлайн-режиме.');
        }
    } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = `<i data-lucide="save" class="w-5 h-5"></i> Отправить отчет`;
        lucide.createIcons();
    }
}

/**
 * Запрашивает текущую геолокацию устройства.
 */
function requestGeolocation() {
    const infoField = document.getElementById('geolocationInfo');
    const geoButton = document.getElementById('geolocationButton');
    
    if (!navigator.geolocation) {
        infoField.textContent = '❌ Геолокация не поддерживается.';
        window.showAlert('Ошибка', 'Ваше устройство не поддерживает геолокацию.');
        return;
    }

    geoButton.disabled = true;
    geoButton.innerHTML = `<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> Поиск...`;
    lucide.createIcons();
    infoField.textContent = 'Определение координат...';

    // Опции для точности и таймаута
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            infoField.textContent = `✅ Координаты: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
            infoField.dataset.lat = lat;
            infoField.dataset.lon = lon;
            
            // Очищаем данные Dadata, чтобы использовать более точную геолокацию
            dadataCoords = null; 
            
            geoButton.disabled = false;
            geoButton.innerHTML = `<i data-lucide="locate-fixed" class="w-5 h-5"></i> Получить геопозицию`;
            lucide.createIcons();
        },
        (error) => {
            let errorMessage = 'Ошибка определения геолокации.';
            if (error.code === error.PERMISSION_DENIED) {
                errorMessage = '🚫 Доступ к геолокации запрещен.';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                errorMessage = '🗺️ Данные о местоположении недоступны.';
            } else if (error.code === error.TIMEOUT) {
                errorMessage = '⌛ Время ожидания истекло.';
            }
            
            infoField.textContent = `❌ ${errorMessage}`;
            infoField.dataset.lat = '';
            infoField.dataset.lon = '';
            
            geoButton.disabled = false;
            geoButton.innerHTML = `<i data-lucide="locate-fixed" class="w-5 h-5"></i> Получить геопозицию`;
            lucide.createIcons();
            
            window.showAlert('Геолокация', errorMessage);
        },
        options
    );
}

/**
 * Повторно отправляет сохраненные оффлайн-отчеты в Firebase.
 */
window.syncOfflineReports = async function() {
    const offlineReports = await window.getOfflineReports();
    if (offlineReports.length === 0) {
        window.showAlert('СИНХРОНИЗАЦИЯ', 'Нет оффлайн-отчетов для отправки.');
        return;
    }
    
    const syncButton = document.getElementById('syncButton');
    const initialText = syncButton.innerHTML;
    syncButton.disabled = true;
    syncButton.innerHTML = `<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> Синхронизация...`;
    lucide.createIcons();

    let syncCount = 0;
    
    // Сортируем по saved_at (самый старый отчет впереди)
    offlineReports.sort((a, b) => a.data.saved_at - b.data.saved_at);

    for (const { key, data: report } of offlineReports) {
        const reportData = { ...report };
        delete reportData.saved_at; // Удаляем служебное поле
        reportData.timestamp = firebase.firestore.FieldValue.serverTimestamp(); 
        
        try {
            await window.db.collection('reports').add(reportData);
            await window.deleteOfflineReport(key);
            
            syncCount++;
            
        } catch (error) {
            console.warn(`Сбой синхронизации отчета (IDB Key: ${key}):`, error.message);
            // Если сбой, прекращаем попытки, чтобы не нагружать сеть или API
            break; 
        }
    }
    
    if (syncCount > 0) {
        window.showAlert('СИНХРОНИЗАЦИЯ', `✅ Успешно отправлено ${syncCount} оффлайн-отчетов в Firebase.`);
    }
    
    // Обновляем список отчетов и оффлайн-индикатор после синхронизации
    updateOfflineIndicator();
    
    syncButton.disabled = false;
    syncButton.innerHTML = initialText;
    lucide.createIcons();
}


/**
 * Обновляет индикатор наличия оффлайн-отчетов.
 */
window.updateOfflineIndicator = async function() {
    const offlineReports = await window.getOfflineReports();
    const count = offlineReports.length;
    
    if (count > 0) {
        infoContainer.classList.remove('hidden');
        document.getElementById('offlineCount').textContent = count;
        document.getElementById('syncButton').classList.remove('hidden');
        document.getElementById('syncButton').disabled = false;
    } else {
        infoContainer.classList.add('hidden');
        document.getElementById('syncButton').classList.add('hidden');
    }
}

/**
 * Сбрасывает форму после успешной отправки.
 */
function resetForm() {
    document.getElementById('reportForm').reset();
    addressInput.value = '';
    selectedSuggestionData = null;
    dadataCoords = null;
    document.getElementById('geolocationInfo').textContent = '—';
    document.getElementById('geolocationInfo').dataset.lat = '';
    document.getElementById('geolocationInfo').dataset.lon = '';
    addressStatus.textContent = 'Введите адрес...';
    
    // Снимаем выбор с радиокнопок
    document.querySelectorAll('input[name="loyalty"]').forEach(radio => radio.checked = false);
}

// ----------------------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ
// ----------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Создаем иконки
    lucide.createIcons();
    
    // 2. Инициализация Firebase и аутентификация
    const authSuccess = window.initializeFirebase ? window.initializeFirebase() : false;
    if (authSuccess) {
        await window.checkAdminStatus();
        
        // 3. Проверка оффлайн-отчетов
        window.updateOfflineIndicator();
        
    } else {
        // Ошибка в firebase-auth.js уже вызвала showAlert, просто блокируем кнопку
        if (saveButton) saveButton.disabled = true;
    }
    
    // 4. Назначаем обработчики событий
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
            requestGeolocation();
        });
    }
    
    const syncButton = document.getElementById('syncButton');
    if (syncButton) {
        syncButton.addEventListener('click', (e) => {
            e.preventDefault();
            window.syncOfflineReports();
        });
    }
});

