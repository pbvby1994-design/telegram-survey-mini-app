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
    // ВАЖНО: Проверяем DADATA_API_KEY. Если его нет, отключаем поиск Dadata.
    if (!DADATA_API_KEY) {
        console.error("DADATA_API_KEY не найден. Поиск адресов Dadata будет недоступен.");
        if (addressStatus) {
            addressStatus.textContent = '⚠️ API Dadata недоступно. Обратитесь к администратору.';
        }
    } else {
        addressInput.addEventListener('input', debounce(handleAddressInput, 300));
        addressInput.addEventListener('focus', () => {
             // Скрываем список при фокусе, если ничего не введено
             if (addressInput.value.length === 0) {
                 suggestionsList.classList.add('hidden');
             }
        });
    }
}

/**
 * Запрос геолокации через браузерное API.
 */
function requestGeolocation() {
    if (navigator.geolocation) {
        addressStatus.textContent = '⏳ Определение местоположения...';
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                dadataCoords = { latitude: lat, longitude: lon };

                // Получение адреса по координатам Dadata
                reverseGeocodeDadata(lat, lon);
            },
            (error) => {
                console.error("Geolocation error:", error);
                addressStatus.textContent = '❌ Не удалось определить местоположение. Введите адрес вручную.';
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    } else {
        addressStatus.textContent = '❌ Геолокация не поддерживается вашим устройством.';
    }
}

/**
 * Обратный геокодинг с использованием Dadata
 * @param {number} lat Широта
 * @param {number} lon Долгота
 */
function reverseGeocodeDadata(lat, lon) {
    if (!DADATA_API_KEY) return;

    fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/geolocate/address", {
        method: "POST",
        mode: "cors",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": "Token " + DADATA_API_KEY
        },
        body: JSON.stringify({ lat: lat, lon: lon })
    })
    .then(response => response.json())
    .then(data => {
        if (data.suggestions && data.suggestions.length > 0) {
            const suggestion = data.suggestions[0];
            
            // Заполнение поля адреса
            addressInput.value = suggestion.value;
            selectedSuggestionData = suggestion.data; // Сохраняем полный объект данных
            
            addressStatus.textContent = '✅ Адрес определен по координатам.';
        } else {
            addressStatus.textContent = '⚠️ Адрес не найден по координатам. Введите вручную.';
        }
    })
    .catch(error => {
        console.error("Dadata reverse geocode error:", error);
        addressStatus.textContent = '❌ Ошибка Dadata API.';
    });
}

/**
 * Декоратор для ограничения частоты вызова функции.
 */
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * Обрабатывает ввод адреса и запрашивает подсказки Dadata.
 */
function handleAddressInput() {
    const query = addressInput.value.trim();

    if (!query || query.length < 3) {
        suggestionsList.classList.add('hidden');
        return;
    }

    if (!DADATA_API_KEY) return;
    
    addressStatus.textContent = '⏳ Поиск адреса...';

    fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address", {
        method: "POST",
        mode: "cors",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": "Token " + DADATA_API_KEY
        },
        body: JSON.stringify({ 
            query: query,
            // Ограничение поиска по FIAS ID Сургутского района
            locations: [{ fias_id: DADATA_LOCATION_FIAS_ID }],
            // Дополнительные ограничения
            restrict_value: true 
        })
    })
    .then(response => response.json())
    .then(data => {
        displaySuggestions(data.suggestions);
        addressStatus.textContent = '';
    })
    .catch(error => {
        console.error("Dadata suggest error:", error);
        addressStatus.textContent = '❌ Ошибка Dadata API.';
    });
}

/**
 * Отображает список подсказок Dadata.
 */
function displaySuggestions(suggestions) {
    suggestionsList.innerHTML = '';

    if (!suggestions || suggestions.length === 0) {
        suggestionsList.classList.add('hidden');
        return;
    }

    suggestions.forEach(suggestion => {
        const item = document.createElement('li');
        item.className = 'p-3 hover:bg-indigo-50 cursor-pointer border-b last:border-b-0 transition-colors';
        item.textContent = suggestion.value;
        
        item.addEventListener('click', () => {
            addressInput.value = suggestion.value;
            selectedSuggestionData = suggestion.data;
            dadataCoords = { 
                latitude: parseFloat(suggestion.data.geo_lat), 
                longitude: parseFloat(suggestion.data.geo_lon) 
            };
            suggestionsList.classList.add('hidden');
            addressStatus.textContent = '✅ Адрес выбран.';
        });

        suggestionsList.appendChild(item);
    });

    suggestionsList.classList.remove('hidden');
}

// ----------------------------------------------------------------------
// ОТПРАВКА ДАННЫХ
// ----------------------------------------------------------------------

/**
 * Собирает данные формы и отправляет отчет.
 */
function getFormData() {
    const form = document.getElementById('reportForm');
    const data = {};

    // 1. Собираем данные формы
    new FormData(form).forEach((value, key) => {
        // Пропускаем незаполненные radio, чтобы не было "on"
        if (key === 'loyalty' || key === 'action') {
            if (value === 'on' || value === '') return;
        }
        data[key] = value;
    });

    // 2. Добавляем данные из Dadata/Geolocation
    if (selectedSuggestionData) {
        data.fias_id = selectedSuggestionData.fias_id || null;
        data.settlement = selectedSuggestionData.settlement_with_type || data.settlement || null;
        data.address = selectedSuggestionData.value || data.address || null;
    } else if (data.address) {
        // Если адрес введен вручную, сохраняем только введенное значение
        data.address = data.address.trim();
        data.settlement = data.settlement || 'Не указан';
    }

    // 3. Добавляем координаты
    if (dadataCoords) {
        data.latitude = dadataCoords.latitude;
        data.longitude = dadataCoords.longitude;
    } else if (selectedSuggestionData && selectedSuggestionData.geo_lat && selectedSuggestionData.geo_lon) {
        // Координаты из Dadata
        data.latitude = parseFloat(selectedSuggestionData.geo_lat);
        data.longitude = parseFloat(selectedSuggestionData.geo_lon);
    }
    
    // 4. Добавляем данные пользователя из window.auth
    data.user_id = window.userTelegramId;
    data.username = window.userTelegramUsername;

    // 5. Очищаем пустые поля
    Object.keys(data).forEach(key => data[key] === null && delete data[key]);
    
    return data;
}

/**
 * Валидация данных формы.
 */
function validateData(data) {
    if (!data.settlement) {
        window.showAlert('Ошибка', 'Пожалуйста, выберите населенный пункт или введите адрес.');
        return false;
    }
    if (!data.loyalty) {
        window.showAlert('Ошибка', 'Пожалуйста, выберите уровень лояльности.');
        return false;
    }
    return true;
}

/**
 * Отправляет отчет в Firebase или сохраняет локально.
 */
window.submitReport = async function() {
    const reportData = getFormData();
    if (!validateData(reportData)) return;

    try {
        if (!window.db) {
            throw new Error("Соединение с Firebase не установлено.");
        }
        
        // Добавляем серверную метку времени
        reportData.timestamp = firebase.firestore.FieldValue.serverTimestamp();
        
        // Отправка в Firebase
        const docRef = await window.db.collection('reports').add(reportData);

        // Отправка подтверждения боту (опционально)
        if (window.Telegram.WebApp) {
            window.Telegram.WebApp.sendData(JSON.stringify({
                status: 'report_saved',
                reportId: docRef.id
            }));
        }

        window.showAlert('Успех', '✅ Отчет успешно сохранен в Firebase!');
        resetForm();
        window.updateOfflineIndicator();
        
    } catch (error) {
        console.error("Ошибка сохранения в Firebase:", error);
        
        // В случае ошибки Firebase (нет сети, сбой токена и т.д.) - сохраняем локально
        reportData.saved_at = Date.now(); // Локальная метка времени
        
        try {
            await window.saveOfflineReport(reportData);
            window.showAlert('Оффлайн', '⚠️ Нет соединения. Отчет сохранен локально и будет отправлен позже.');
            resetForm();
            window.updateOfflineIndicator();
            
        } catch (localError) {
            window.showAlert('Критическая Ошибка', `❌ Не удалось сохранить отчет локально: ${localError.message}`);
        }
    }
}

// ----------------------------------------------------------------------
// ОФФЛАЙН / PWA ЛОГИКА
// ----------------------------------------------------------------------

/**
 * Обновляет индикатор оффлайн-отчетов.
 */
window.updateOfflineIndicator = async function() {
    const offlineReports = await window.getOfflineReports();
    if (infoContainer) {
        if (offlineReports.length > 0) {
            infoContainer.textContent = `💾 ${offlineReports.length} оффлайн-отчетов в ожидании отправки.`;
            infoContainer.classList.remove('hidden');
            infoContainer.classList.remove('bg-gray-100');
            infoContainer.classList.add('bg-yellow-100');
        } else {
            infoContainer.textContent = '';
            infoContainer.classList.add('hidden');
        }
    }
}

/**
 * Синхронизирует локальные отчеты с Firebase.
 */
window.syncOfflineReports = async function() {
    const offlineReports = await window.getOfflineReports();
    if (offlineReports.length === 0) {
        window.showAlert('СИНХРОНИЗАЦИЯ', 'Нет оффлайн-отчетов для отправки.');
        return;
    }
    
    let syncCount = 0;
    
    // Сортируем по saved_at, чтобы отправлять старые отчеты первыми
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
    if (window.loadReports) {
        await window.loadReports(window.isAdmin ? 'all' : 'my');
    }
    const remainingReports = await window.getOfflineReports();
    if (infoContainer) {
        if (remainingReports.length === 0) {
            infoContainer.textContent = '';
            infoContainer.classList.add('hidden');
        } else {
            infoContainer.textContent = `💾 ${remainingReports.length} оффлайн-отчетов в ожидании отправки.`;
        }
    }
}


// ----------------------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ
// ----------------------------------------------------------------------

/**
 * Очистка формы после отправки
 */
function resetForm() {
    document.getElementById('reportForm').reset();
    addressInput.value = '';
    suggestionsList.classList.add('hidden');
    dadataCoords = null;
    selectedSuggestionData = null;
    addressStatus.textContent = '';
    
    // Снимаем выбор с радиокнопок
    document.querySelectorAll('input[type="radio"]').forEach(radio => radio.checked = false);
}


document.addEventListener('DOMContentLoaded', async () => {
    // 1. Создаем иконки
    lucide.createIcons();
    
    // 2. Инициализация Firebase и аутентификация
    const authSuccess = window.initializeFirebase ? window.initializeFirebase() : false;
    if (authSuccess) {
        await window.checkAdminStatus();
        
        // 3. Проверка оффлайн-отчетов
        window.updateOfflineIndicator();
        
        // 4. Синхронизация при старте, если есть сеть
        if (navigator.onLine) {
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
