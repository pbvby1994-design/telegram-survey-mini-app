// main.js (ОБНОВЛЕННАЯ ВЕРСИЯ)

// --- Глобальные переменные ---
window.mapInstance = null; 
let currentLatitude = null; 
let currentLongitude = null;
let dadataCoords = null;    

let selectedSuggestionData = null; 

const addressInput = document.getElementById('address');
const suggestionsList = document.getElementById('suggestionsList');

/**
 * Ручной обработчик ввода для Dadata
 */
if (addressInput) {
    addressInput.addEventListener('input', async () => {
        // Используем глобальный токен из firebase-auth.js
        const DADATA_API_KEY = window.DADATA_TOKEN; 
        if (!DADATA_API_KEY) {
             console.error("Dadata Token не загружен.");
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
                method: "POST",
                mode: "cors",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": "Token " + DADATA_API_KEY
                },
                body: JSON.stringify({
                    query: query,
                    count: 5,
                    // Используем глобальные ограничения из firebase-auth.js (Сургутский район)
                    locations: window.DADATA_LOCATION_RESTRICTIONS || [], 
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            suggestionsList.innerHTML = '';
            suggestionsList.classList.remove('hidden');

            data.suggestions.forEach(suggestion => {
                const li = document.createElement('li');
                li.textContent = suggestion.value;
                li.className = 'p-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600';
                li.onclick = () => selectSuggestion(suggestion);
                suggestionsList.appendChild(li);
            });

        } catch (error) {
            console.error("Dadata fetch error:", error);
            suggestionsList.innerHTML = '';
            suggestionsList.classList.add('hidden');
        }
    });
    
    // Скрытие списка при потере фокуса
    addressInput.addEventListener('blur', () => {
        // Добавляем небольшую задержку, чтобы успел сработать click на li
        setTimeout(() => {
            if (!suggestionsList.matches(':hover')) {
                suggestionsList.classList.add('hidden');
            }
        }, 150); 
    });
}

function selectSuggestion(suggestion) {
    addressInput.value = suggestion.value;
    selectedSuggestionData = suggestion.data;
    suggestionsList.classList.add('hidden');
    document.getElementById('addressError').style.display = 'none';
    
    // Сохраняем координаты Dadata
    if (selectedSuggestionData.geo_lat && selectedSuggestionData.geo_lon) {
        dadataCoords = { 
            lat: parseFloat(selectedSuggestionData.geo_lat), 
            lon: parseFloat(selectedSuggestionData.geo_lon) 
        };
    } else {
        dadataCoords = null;
    }
}

/**
 * Получение текущей геолокации.
 */
window.getCurrentLocation = function() {
    if (navigator.geolocation) {
        const geoInfo = document.getElementById('geoInfo');
        geoInfo.textContent = 'Определение координат...';
        
        // Устанавливаем таймаут 5 секунд
        const options = {
            enableHighAccuracy: true,
            timeout: 5000, 
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLatitude = position.coords.latitude;
                currentLongitude = position.coords.longitude;
                geoInfo.textContent = `Координаты: ${currentLatitude.toFixed(4)}, ${currentLongitude.toFixed(4)} (GPS)`;
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            },
            (error) => {
                console.error("Ошибка геолокации:", error);
                currentLatitude = null;
                currentLongitude = null;
                geoInfo.textContent = 'Координаты: не получены';
                window.showAlert('Ошибка GPS', `Не удалось получить GPS: ${error.message}`);
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            },
            options
        );
    } else {
        window.showAlert('Ошибка', 'Ваше устройство не поддерживает геолокацию.');
    }
}

/**
 * Очистка текущих координат GPS.
 */
window.clearCurrentLocation = function() {
    currentLatitude = null;
    currentLongitude = null;
    document.getElementById('geoInfo').textContent = 'Координаты: нет';
    window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
}

/**
 * Сохранение отчета в Firestore.
 */
window.saveReport = async function() {
    document.getElementById('addressError').style.display = 'none';
    const form = document.getElementById('reportForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const formData = new FormData(form);
    const docId = formData.get('docId'); // Для редактирования

    // 1. Критическая проверка: выбран ли адрес Dadata
    if (!selectedSuggestionData && dadataCoords === null && !docId) { 
         document.getElementById('addressError').style.display = 'block';
         window.showAlert('Ошибка данных', 'Пожалуйста, выберите адрес из выпадающего списка Dadata.');
         return;
    }
    
    // 2. Определение финальных координат
    const finalLatitude = currentLatitude || dadataCoords?.lat;
    const finalLongitude = currentLongitude || dadataCoords?.lon;

    // КРИТИЧЕСКАЯ ПРОВЕРКА КООРДИНАТ: Отчет без координат бесполезен.
    if (!finalLatitude || !finalLongitude) {
        document.getElementById('addressError').style.display = 'block';
        window.showAlert('Ошибка координат', 'Выбранный адрес не содержит GPS-координат. Пожалуйста, убедитесь, что адрес выбран из списка Dadata ИЛИ что GPS успешно получен.');
        return;
    }


    try {
        const reportData = {
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            user_id: window.userTelegramId,
            username: window.userTelegramUsername,
            
            settlement: formData.get('settlement').trim(),
            address: formData.get('address').trim(),
            
            loyalty: formData.get('loyalty'),
            action: formData.get('action'),
            comment: formData.get('comment').trim(),
            
            latitude: finalLatitude,
            longitude: finalLongitude,
            
            // Дополнительные данные Dadata
            dadata_fias_id: selectedSuggestionData?.fias_id || null,
            dadata_kladr_id: selectedSuggestionData?.kladr_id || null,
        };

        let reportRef;
        if (docId) {
            // Редактирование существующего документа
            reportRef = window.db.collection('reports').doc(docId);
            await reportRef.update(reportData);
            window.showAlert('Успех', 'Отчет успешно обновлен!');
        } else {
            // Создание нового документа
            reportRef = await window.db.collection('reports').add(reportData);
            window.showAlert('Успех', 'Отчет успешно сохранен!');
        }
        
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        
        // 3. Очистка формы
        // Очищаем нужные поля вручную, чтобы сохранить settlement
        const settlementValue = document.getElementById('settlement').value;
        form.reset();
        document.getElementById('settlement').value = settlementValue;
        
        selectedSuggestionData = null;
        dadataCoords = null;
        window.clearCurrentLocation(); // Очищаем GPS

        // 4. Отправка данных обратно в бот
        window.Telegram.WebApp.sendData(JSON.stringify({
            status: 'report_saved',
            reportId: reportRef.id,
        }));
        
        // Обновляем список "Мои Отчеты" после сохранения
        if (typeof window.fetchReports === 'function') {
             window.fetchReports(null); 
        }

    } catch (error) {
        console.error("Ошибка сохранения отчета:", error);
        window.showAlert('Ошибка', `Не удалось сохранить отчет: ${error.message}`);
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
    }
}

/**
 * Инициализация Яндекс.Карты. Вызывается динамически после загрузки SDK.
 * (Определено как window.initMap для работы с Yandex API)
 */
window.initMap = function() {
    document.getElementById('mapLoading')?.classList.add('hidden');
    document.getElementById('map')?.classList.remove('hidden');

    window.mapInstance = new ymaps.Map("map", {
        // Координаты Сургутского района или центра ХМАО
        center: [61.25, 73.4], 
        zoom: 9,
        controls: ['zoomControl', 'fullscreenControl']
    }, {
        suppressMapOpenBlock: true // Скрыть блок 'Открыть карту'
    });

    // После инициализации карты, сразу загружаем данные, если находимся на вкладке карты
    const currentSection = document.querySelector('.section:not(.hidden)')?.id;
    if (currentSection === 'map-view' && typeof window.fetchReports === 'function') {
        window.fetchReports(document.getElementById('settlementFilter')?.value || null, true);
    }
}


/**
 * Основная функция, запускающаяся после загрузки DOM.
 * Проверяет аутентификацию и запускает приложение.
 */
window.checkAuthAndStart = async function() {
    
    // 1. Инициализация Firebase (считывает все ключи из URL)
    if (!window.initializeFirebase()) {
         // Ошибка инициализации уже обработана в initializeFirebase
         return;
    }
    
    // 2. Проверка статуса админа и аутентификация
    const authSuccess = await window.checkAdminStatus(); 

    if (authSuccess) {
        const urlParams = new URLSearchParams(window.location.search);
        const urlRole = urlParams.get('role'); // Role из URL бота
        const initialView = urlParams.get('view') || 'form-view'; // Начальная вкладка
        
        // 3. Настройка UI (видимость кнопок)
        if (window.isAdmin) {
            // Админ видит все
            document.getElementById('btn-map-view')?.classList.remove('hidden');
            document.getElementById('btn-stats')?.classList.remove('hidden');
            document.getElementById('btn-raw-data')?.classList.remove('hidden');
            document.getElementById('btn-my-reports-view')?.classList.remove('hidden');
        } else {
            // Агитатор видит только Форму и Мои Отчеты
            document.getElementById('btn-map-view')?.classList.add('hidden');
            document.getElementById('btn-stats')?.classList.add('hidden');
            document.getElementById('btn-raw-data')?.classList.add('hidden');
            document.getElementById('btn-my-reports-view')?.classList.remove('hidden');
        }

        // 4. Выбор начального раздела
        let startSection = initialView;
        
        // Если пользователь Админ, то по умолчанию показываем карту
        if (window.isAdmin && (urlRole === 'admin' || startSection === 'form-view')) {
             startSection = 'map-view';
        }
        // Если Агитатор пришел на панель Админа, то принудительно показываем форму/отчеты
        if (!window.isAdmin && (startSection === 'map-view' || startSection === 'stats' || startSection === 'raw-data')) {
             startSection = 'form-view';
        }

        // 5. Отображение
        window.showSection(startSection);
        
        // 6. Инициализация панели администратора (заполнение фильтров НП)
        if (window.isAdmin && typeof window.loadDashboard === 'function') {
            window.loadDashboard();
        }
        
    } else {
         window.showSection('form-view');
         document.getElementById('saveButton')?.setAttribute('disabled', 'true');
         window.showAlert('Доступ ограничен', 'Не удалось пройти аутентификацию. Перезапустите приложение через бота.');
    }
}

