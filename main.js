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
// ГЕОЛОКАЦИЯ
// ----------------------------------------------------------------------

/**
 * Запрашивает текущую геолокацию пользователя.
 */
function requestGeolocation() {
    if (!navigator.geolocation) {
        window.showAlert('Геолокация', '⚠️ Геолокация не поддерживается вашим браузером.');
        return;
    }

    const geolocationButton = document.getElementById('geolocationButton');
    if (geolocationButton) {
        geolocationButton.innerHTML = `<i data-lucide="loader-circle" class="w-5 h-5 mr-2 animate-spin"></i> Определение...`;
        geolocationButton.disabled = true;
    }

    // Очистка предыдущих координат
    dadataCoords = null;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            dadataCoords = { lat, lon };

            window.showAlert('Геолокация', `✅ Координаты получены: ${lat.toFixed(4)}, ${lon.toFixed(4)}.`);
            if (geolocationButton) {
                geolocationButton.innerHTML = `<i data-lucide="map-pin" class="w-5 h-5 mr-2"></i> Определено`;
                geolocationButton.classList.remove('bg-yellow-500');
                geolocationButton.classList.add('bg-green-500');
                geolocationButton.disabled = false;
            }
        },
        (error) => {
            console.error("Geolocation error:", error);
            window.showAlert('Геолокация', `❌ Не удалось определить местоположение: ${error.message}.`);
            if (geolocationButton) {
                geolocationButton.innerHTML = `<i data-lucide="map-pin" class="w-5 h-5 mr-2"></i> Геолокация`;
                geolocationButton.classList.remove('bg-green-500');
                geolocationButton.classList.add('bg-yellow-500');
                geolocationButton.disabled = false;
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// ----------------------------------------------------------------------
// DADATA АВТОЗАПОЛНЕНИЕ
// ----------------------------------------------------------------------

/**
 * Отправляет запрос к Dadata для получения подсказок.
 * @param {string} query Текст для поиска.
 */
async function fetchDadataSuggestions(query) {
    // Ключ Dadata берется из глобальной переменной, установленной в firebase-auth.js
    const DADATA_API_KEY = window.DADATA_API_KEY;

    if (!DADATA_API_KEY || !query) {
        suggestionsList.innerHTML = '';
        return;
    }

    try {
        addressStatus.textContent = '... Поиск адресов';
        addressStatus.classList.remove('text-red-500', 'text-green-500');

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
                // Ограничение по региону (например, ХМАО)
                locations: [{ "region_fias_id": DADATA_LOCATION_FIAS_ID }],
                count: 5 // Максимум 5 подсказок
            })
        });

        const data = await response.json();
        renderSuggestions(data.suggestions);

    } catch (error) {
        console.error("Dadata fetch error:", error);
        addressStatus.textContent = '❌ Ошибка API Dadata';
        suggestionsList.innerHTML = '';
        window.showAlert('Ошибка Dadata', `Не удалось получить адресные подсказки: ${error.message}.`);
    }
}

/**
 * Отображает список подсказок.
 * @param {Array} suggestions Массив подсказок от Dadata.
 */
function renderSuggestions(suggestions) {
    suggestionsList.innerHTML = '';
    if (!suggestions || suggestions.length === 0) {
        addressStatus.textContent = '⚠️ Адрес не найден';
        return;
    }

    addressStatus.textContent = '✅ Выберите адрес';

    suggestions.forEach(suggestion => {
        const li = document.createElement('li');
        li.className = 'p-2 hover:bg-indigo-100 cursor-pointer border-b last:border-b-0 text-sm';
        li.textContent = suggestion.value;
        li.onclick = () => selectSuggestion(suggestion);
        suggestionsList.appendChild(li);
    });
}

/**
 * Обрабатывает выбор адреса из списка.
 * @param {Object} suggestion Выбранный объект Dadata.
 */
function selectSuggestion(suggestion) {
    addressInput.value = suggestion.value;
    selectedSuggestionData = suggestion.data;
    suggestionsList.innerHTML = '';
    addressStatus.textContent = '✅ Адрес выбран';

    // Очистка координат геолокации, т.к. выбран адрес вручную
    dadataCoords = null;
}

/**
 * Debounced обработчик ввода.
 */
const handleAddressInput = debounce(() => {
    fetchDadataSuggestions(addressInput.value);
}, 300);


// ----------------------------------------------------------------------
// ОТПРАВКА ОТЧЕТА (FIREBASE / INDEXEDDB)
// ----------------------------------------------------------------------

/**
 * Валидация формы.
 * @returns {boolean} Результат валидации.
 */
function validateForm() {
    const settlement = document.getElementById('settlement').value;
    const loyalty = document.querySelector('input[name="loyalty"]:checked');
    const action = document.getElementById('action').value;
    const notes = document.getElementById('notes').value;

    if (!settlement) {
        window.showAlert('Ошибка', '⚠️ Пожалуйста, выберите населенный пункт.');
        return false;
    }

    if (!loyalty) {
        window.showAlert('Ошибка', '⚠️ Пожалуйста, выберите статус лояльности.');
        return false;
    }

    if (!addressInput.value && !dadataCoords) {
        window.showAlert('Ошибка', '⚠️ Укажите адрес или определите геолокацию.');
        return false;
    }

    if (!action) {
        window.showAlert('Ошибка', '⚠️ Пожалуйста, укажите, что было сделано.');
        return false;
    }

    // Проверка, что адрес, если он был введен, является подтвержденным Dadata,
    // ИЛИ что были получены координаты геолокации.
    if (addressInput.value) {
         if (!selectedSuggestionData || selectedSuggestionData.house !== addressInput.value.split(',').pop().trim()) {
              // Это очень упрощенная проверка. В идеале нужно парсить и сравнивать FIAS ID.
              // Для простоты, если адрес введен вручную и не был выбран из подсказок, предупреждаем.
              // Однако, если координаты есть, разрешаем.
              if (!dadataCoords) {
                  window.showAlert('Предупреждение', 'Адрес введен вручную, но не выбран из списка Dadata. Убедитесь в его корректности или используйте геолокацию.');
              }
         }
    }


    if (notes.length > 500) {
        window.showAlert('Ошибка', '⚠️ Комментарий не должен превышать 500 символов.');
        return false;
    }

    return true;
}

/**
 * Сборка данных отчета.
 * @returns {Object} Объект отчета.
 */
function collectReportData() {
    const settlement = document.getElementById('settlement').value;
    const loyalty = document.querySelector('input[name="loyalty"]:checked').value;
    const action = document.getElementById('action').value;
    const notes = document.getElementById('notes').value;

    let latitude = null;
    let longitude = null;
    let address = addressInput.value.trim();

    if (dadataCoords) {
        // Если есть координаты геолокации, используем их
        latitude = dadataCoords.lat;
        longitude = dadataCoords.lon;
        // Если геолокация, но адрес не вводился, используем 'Геолокация'
        if (!address) address = `Геолокация (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;

    } else if (selectedSuggestionData) {
        // Если выбран адрес Dadata, используем его координаты
        latitude = parseFloat(selectedSuggestionData.geo_lat) || null;
        longitude = parseFloat(selectedSuggestionData.geo_lon) || null;
    }


    const reportData = {
        user_id: window.userTelegramId,
        username: window.userTelegramUsername,
        settlement: settlement,
        loyalty: loyalty,
        action: action,
        notes: notes,
        address: address,
        latitude: latitude,
        longitude: longitude
    };

    return reportData;
}

/**
 * Отправка отчета в Firebase или сохранение в IndexedDB.
 */
async function submitReport() {
    if (!validateForm()) {
        return;
    }

    const reportData = collectReportData();
    const saveButton = document.getElementById('saveButton');
    const originalButtonText = saveButton.innerHTML;

    // Блокировка кнопки и показ загрузки
    saveButton.disabled = true;
    saveButton.innerHTML = `<i data-lucide="loader-circle" class="w-5 h-5 mr-2 animate-spin"></i> Сохранение...`;

    try {
        if (window.db && navigator.onLine) {
            // 1. ОНЛАЙН: Отправка в Firebase
            await window.db.collection('reports').add({
                ...reportData,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 2. Отправка подтверждения в Telegram Bot (WebApp.sendData)
            if (window.Telegram.WebApp && window.Telegram.WebApp.sendData) {
                window.Telegram.WebApp.sendData(JSON.stringify({
                    status: 'report_saved',
                    user_id: reportData.user_id,
                    settlement: reportData.settlement
                }));
            }

            window.showAlert('Успех', '✅ Отчет успешно сохранен в Firebase.');
            resetForm();
            window.updateOfflineIndicator(); // Обновление индикатора на всякий случай

        } else if (window.saveOfflineReport) {
            // 3. ОФФЛАЙН: Сохранение в IndexedDB
            await window.saveOfflineReport({
                ...reportData,
                saved_at: Date.now() // Для сортировки при синхронизации
            });
            window.showAlert('Оффлайн', '💾 Отчет сохранен локально. Синхронизируется при появлении сети.');
            resetForm();
            window.updateOfflineIndicator();
        } else {
             window.showAlert('Критическая Ошибка', 'Не удалось сохранить отчет (нет Firebase/IndexedDB).');
        }

    } catch (error) {
        console.error("Error submitting report:", error);
        window.showAlert('Ошибка Сервера', `Не удалось отправить отчет: ${error.message}. Попробуйте позже.`);
        // Если сбой, сохраняем в IndexedDB как запасной вариант (если доступен)
        if (!navigator.onLine && window.saveOfflineReport) {
            await window.saveOfflineReport({
                ...reportData,
                saved_at: Date.now()
            });
            window.showAlert('Оффлайн (Запасной)', '💾 Отчет сохранен локально (после ошибки). Синхронизируется при появлении сети.');
            resetForm();
            window.updateOfflineIndicator();
        }
    } finally {
        // Восстановление кнопки
        saveButton.innerHTML = originalButtonText;
        saveButton.disabled = false;
        // Очистка выбранных данных Dadata
        selectedSuggestionData = null;
        dadataCoords = null;
        // Восстановление кнопки геолокации
        const geolocationButton = document.getElementById('geolocationButton');
        if (geolocationButton) {
            geolocationButton.innerHTML = `<i data-lucide="map-pin" class="w-5 h-5 mr-2"></i> Геолокация`;
            geolocationButton.classList.remove('bg-green-500');
            geolocationButton.classList.add('bg-yellow-500');
            geolocationButton.disabled = false;
        }

    }
}


/**
 * Обновляет индикатор наличия оффлайн-отчетов.
 */
window.updateOfflineIndicator = async function() {
    if (!window.getOfflineReports || !infoContainer) return;

    const offlineReports = await window.getOfflineReports();
    if (offlineReports.length > 0) {
        infoContainer.classList.remove('hidden');
        infoContainer.textContent = `💾 Оффлайн-отчеты: ${offlineReports.length}. Нажмите "Синхронизировать".`;
    } else {
        infoContainer.classList.add('hidden');
    }
}

/**
 * Синхронизирует оффлайн-отчеты с Firebase.
 */
window.syncOfflineReports = async function() {
    if (!window.db) {
        window.showAlert('СИНХРОНИЗАЦИЯ', '❌ Firebase не инициализирован. Невозможно синхронизировать.');
        return;
    }

    if (!window.getOfflineReports) {
        window.showAlert('СИНХРОНИЗАЦИЯ', '❌ Оффлайн-логика не загружена.');
        return;
    }

    const offlineReports = await window.getOfflineReports();
    if (offlineReports.length === 0) {
        window.showAlert('СИНХРОНИЗАЦИЯ', '✅ Оффлайн-отчетов нет. Все данные актуальны.');
        return;
    }

    const syncButton = document.getElementById('syncButton');
    const originalButtonText = syncButton.innerHTML;

    syncButton.disabled = true;
    syncButton.innerHTML = `<i data-lucide="loader-circle" class="w-5 h-5 mr-2 animate-spin"></i> Синхронизация...`;

    let syncCount = 0;

    try {
        // Сортировка по полю saved_at (самый старый отчет - первый)
        offlineReports.sort((a, b) => a.data.saved_at - b.data.saved_at);

        for (const { key, data: report } of offlineReports) {
            const reportData = { ...report };
            delete reportData.saved_at; // Удаляем служебное поле
            reportData.timestamp = firebase.firestore.FieldValue.serverTimestamp();

            await window.db.collection('reports').add(reportData);
            await window.deleteOfflineReport(key);

            syncCount++;
        }

        window.showAlert('СИНХРОНИЗАЦИЯ', `✅ Успешно отправлено ${syncCount} оффлайн-отчетов в Firebase.`);

    } catch (error) {
        console.error("Сбой синхронизации:", error);
        window.showAlert('СИНХРОНИЗАЦИЯ', `❌ Сбой синхронизации. Отправлено ${syncCount} отчетов. Оставшиеся будут отправлены позже: ${error.message}`);

    } finally {
        syncButton.innerHTML = originalButtonText;
        syncButton.disabled = false;

        // Обновляем список отчетов и оффлайн-индикатор после синхронизации
        window.updateOfflineIndicator();
    }
}


/**
 * Очистка формы после успешной отправки.
 */
function resetForm() {
    document.getElementById('settlement').value = '';
    document.getElementById('action').value = '';
    document.getElementById('notes').value = '';
    addressInput.value = '';
    selectedSuggestionData = null;
    dadataCoords = null;
    suggestionsList.innerHTML = '';
    addressStatus.textContent = 'Введите адрес или используйте геолокацию.';
    // Снимаем выбор с радио-кнопок
    const loyaltyRadios = document.querySelectorAll('input[name="loyalty"]');
    loyaltyRadios.forEach(radio => radio.checked = false);
}


// ----------------------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ
// ----------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Создаем иконки
    lucide.createIcons();

    // 2. Инициализация Firebase и аутентификация
    // Мы полагаемся на index.html, что initializeFirebase() уже был вызван
    // и установил window.DADATA_API_KEY и другие глобальные переменные.
    // Здесь только назначаем обработчики.

    // 3. Проверка оффлайн-отчетов
    // Это нужно, чтобы индикатор появился сразу при входе на main.html
    if (window.updateOfflineIndicator) {
        window.updateOfflineIndicator();
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
            // Вызов функции, которая теперь определена выше
            requestGeolocation();
        });
    }

    // Обработчик для Dadata
    if (addressInput) {
        addressInput.addEventListener('input', handleAddressInput);
        addressInput.addEventListener('focus', handleAddressInput);

        // Блокируем ввод, если нет ключа API Dadata (ключ должен быть установлен в firebase-auth.js)
        // ВАЖНО: Проверка DADATA_API_KEY должна быть после успешной initializeFirebase,
        // но на странице main.html мы полагаемся, что он установлен глобально.
        if (!window.DADATA_API_KEY) {
            addressInput.placeholder = 'Dadata API недоступен.';
            addressInput.disabled = true;
            addressStatus.textContent = '⚠️ API Dadata недоступно. Обратитесь к администратору.';
        }
    }

    const syncButton = document.getElementById('syncButton');
    if (syncButton) {
        syncButton.addEventListener('click', (e) => {
            e.preventDefault();
            window.syncOfflineReports();
        });
    }
});
