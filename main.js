// main.js (ФИНАЛЬНАЯ ВЕРСИЯ С НАДЕЖНОЙ ГЕОЛОКАЦИЕЙ)

// --- Глобальные переменные ---
window.mapInstance = null; 
let currentLatitude = null; 
let currentLongitude = null;
let dadataCoords = null;    

// --- КОНФИГУРАЦИЯ DADATA (Из config.js) ---
// Используем ключ, который был в вашем config.js
const DADATA_API_KEY = '29c85666d57139f459e452d1290dd73c23708472'; 
// Используем FIAS ID ХМАО для ограничения поиска, если он передан из бота.
const DADATA_LOCATION_FIAS_ID = new URLSearchParams(window.location.search).get('dadata_fias_id') || '86';

let selectedSuggestionData = null; 

const addressInput = document.getElementById('address');
const suggestionsList = document.getElementById('suggestionsList');

/**
 * Ручной обработчик ввода для Dadata
 */
if (addressInput) {
    addressInput.addEventListener('input', async () => {
        const query = addressInput.value.trim();
        if (query.length < 3) {
            suggestionsList?.innerHTML = '';
            suggestionsList?.classList.add('hidden');
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
                    // Ограничение поиска по региону (ХМАО - FIAS ID 86)
                    locations: [{ "kladr_id": DADATA_LOCATION_FIAS_ID }]
                })
            });

            const data = await response.json();
            renderSuggestions(data.suggestions);

        } catch (error) {
            console.error("Dadata API error:", error);
            document.getElementById('addressStatus').textContent = 'Ошибка Dadata. Попробуйте ввести адрес вручную.';
            suggestionsList?.classList.add('hidden');
        }
    });
}

/**
 * Отображение подсказок Dadata
 */
function renderSuggestions(suggestions) {
    suggestionsList.innerHTML = '';
    if (suggestions && suggestions.length > 0) {
        suggestionsList.classList.remove('hidden');
        document.getElementById('addressStatus').textContent = '';

        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'p-3 text-sm cursor-pointer hover:bg-gray-100 transition duration-150 border-t border-gray-100 first:border-t-0';
            item.textContent = suggestion.value;
            item.onclick = () => selectSuggestion(suggestion);
            suggestionsList.appendChild(item);
        });
    } else {
        suggestionsList.classList.add('hidden');
    }
}

/**
 * Выбор подсказки Dadata
 */
function selectSuggestion(suggestion) {
    addressInput.value = suggestion.value;
    suggestionsList.innerHTML = '';
    suggestionsList.classList.add('hidden');
    selectedSuggestionData = suggestion.data;

    // Сохраняем координаты из Dadata
    if (selectedSuggestionData.geo_lat && selectedSuggestionData.geo_lon) {
        dadataCoords = {
            lat: parseFloat(selectedSuggestionData.geo_lat),
            lon: parseFloat(selectedSuggestionData.geo_lon)
        };
        document.getElementById('addressStatus').textContent = `✅ Адрес найден. Координаты: ${dadataCoords.lat}, ${dadataCoords.lon}`;
    } else {
        dadataCoords = null;
        document.getElementById('addressStatus').textContent = '⚠️ Координаты для этого адреса отсутствуют. Будет запрошена геолокация.';
    }
}

// ----------------------------------------------------------------------
// ОТПРАВКА ФОРМЫ (ИСПРАВЛЕНА ЛОГИКА ГЕОЛОКАЦИИ)
// ----------------------------------------------------------------------

if (document.getElementById('reportForm')) {
    document.getElementById('reportForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        // 1. Проверяем, что адрес валиден (выбран из списка)
        if (!selectedSuggestionData) {
            window.showAlert('Ошибка адреса', 'Пожалуйста, выберите адрес из предложенного списка Dadata.');
            return;
        }

        // 2. Блокируем кнопку отправки и меняем текст
        const saveButton = document.getElementById('saveButton');
        saveButton.setAttribute('disabled', 'true');
        saveButton.innerHTML = '<svg data-lucide="loader" class="w-5 h-5 animate-spin"></svg> <span>Получение координат...</span>';
        lucide.createIcons();

        // 3. Запускаем попытку получения координат
        fetchGeolocationAndSubmit(e.target);
    });
}

/**
 * 1. Получает геолокацию с обработкой ошибок.
 * 2. Если не удается, использует координаты Dadata (dadataCoords).
 * 3. Отправляет отчет.
 * @param {HTMLFormElement} form 
 */
function fetchGeolocationAndSubmit(form) {
    const geoOptions = {
        enableHighAccuracy: true,
        timeout: 7000, // Увеличим таймаут для WebApp
        maximumAge: 0
    };

    const submitReport = (lat, lon) => {
        // Устанавливаем полученные координаты, если они есть
        currentLatitude = lat;
        currentLongitude = lon;

        // Отправка отчета в Firestore
        sendReportToFirestore(form);
    };

    // Если координаты Dadata УЖЕ есть, но геолокация не нужна, можно использовать их сразу
    // НО: мы всегда стараемся получить Live Geo, как более точную.

    // Пробуем получить геолокацию
    navigator.geolocation.getCurrentPosition(
        (position) => {
            // УСПЕХ: Получили координаты с устройства
            console.log("Geolocation obtained from navigator.");
            window.showAlert('Геолокация', 'Использованы точные координаты телефона.');
            submitReport(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
            // ОШИБКА: Пользователь запретил, таймаут или другая ошибка
            console.warn(`Geolocation failed (${error.code}): ${error.message}. Falling back to Dadata coordinates.`);
            
            // Fallback: Используем координаты из Dadata
            if (dadataCoords && dadataCoords.lat && dadataCoords.lon) {
                console.log("Using Dadata coordinates for report.");
                window.showAlert('Координаты Dadata', 'Не удалось получить геолокацию. Использованы координаты адреса.');
                submitReport(dadataCoords.lat, dadataCoords.lon);
            } else {
                // КРИТИЧЕСКАЯ ОШИБКА: Нет ни live geo, ни Dadata
                const saveButton = document.getElementById('saveButton');
                saveButton.removeAttribute('disabled');
                saveButton.innerHTML = '<svg data-lucide="send" class="w-5 h-5"></svg> <span>Сохранить отчет</span>';
                lucide.createIcons();

                window.showAlert('Ошибка координат', 'Не удалось определить координаты. Отчет не сохранен.');
                
                // Оповещение Telegram о неудаче
                if (window.Telegram.WebApp && window.Telegram.WebApp.sendData) {
                    window.Telegram.WebApp.sendData(JSON.stringify({ status: 'report_failed' }));
                }
            }
        },
        geoOptions
    );
}

/**
 * Отправляет данные отчета в Firestore
 * @param {HTMLFormElement} form 
 */
async function sendReportToFirestore(form) {
    const timestamp = new Date();
    const settlement = form.elements['settlement'].value;
    const address = form.elements['address'].value;
    const loyalty = form.elements['loyalty'].value;
    const action = form.elements['action'].value;
    const comment = form.elements['comment'].value;

    // Объект данных для Firestore
    const reportData = {
        timestamp: timestamp, // Будет заменено на serverTimestamp в reports.js/cloud functions
        user_id: window.userTelegramId,
        username: window.userTelegramUsername,
        settlement: settlement,
        address: address,
        loyalty: loyalty,
        action: action,
        comment: comment,
        latitude: currentLatitude, // Используем полученные координаты
        longitude: currentLongitude // Используем полученные координаты
    };

    const saveButton = document.getElementById('saveButton');
    saveButton.innerHTML = '<svg data-lucide="loader" class="w-5 h-5 animate-spin"></svg> <span>Отправка...</span>';
    lucide.createIcons();

    try {
        const docRef = await window.db.collection('reports').add(reportData);
        
        // 1. Оповещение Telegram о сохранении
        if (window.Telegram.WebApp) {
             window.Telegram.WebApp.sendData(JSON.stringify({ 
                status: 'report_saved', 
                reportId: docRef.id,
                user_id: window.userTelegramId,
                username: window.userTelegramUsername
            }));
        }
        
        // 2. Обновление интерфейса
        window.showAlert('Успех', `Отчет ID: ${docRef.id} успешно сохранен.`);
        form.reset();
        document.getElementById('addressStatus').textContent = '';
        dadataCoords = null; // Сброс координат
        selectedSuggestionData = null; // Сброс выбранного адреса
        currentLatitude = null;
        currentLongitude = null;
        
        // 3. Обновление Моих Отчетов, если мы на вкладке
        if (window.updateMyReportsView) {
             window.updateMyReportsView();
        }
        
    } catch (error) {
        console.error("Error writing document: ", error);
        window.showAlert('Ошибка Firebase', `Не удалось сохранить отчет: ${error.message}. Проверьте правила безопасности.`);
    } finally {
        // Разблокируем кнопку
        saveButton.removeAttribute('disabled');
        saveButton.innerHTML = '<svg data-lucide="send" class="w-5 h-5"></svg> <span>Сохранить отчет</span>';
        lucide.createIcons();
    }
}

/**
 * Инициализация Yandex Maps
 */
window.initMap = function() {
    if (typeof ymaps === 'undefined') {
        window.showAlert('Ошибка Карты', 'Скрипт Yandex Maps не загружен.');
        document.getElementById('mapLoading')?.classList.add('hidden');
        return;
    }
    
    // Центр по ХМАО (Сургут)
    window.mapInstance = new ymaps.Map("map", {
        center: [61.25, 73.4], 
        zoom: 7,
        controls: ['zoomControl', 'fullscreenControl']
    });
    
    // Скрываем загрузку карты
    document.getElementById('mapLoading')?.classList.add('hidden');

    // Если раздел "Карта" активен, вызываем загрузку данных для карты
    if (document.getElementById('map-view')?.classList.contains('active-tab')) {
        if (window.loadMapData) {
            window.loadMapData(); 
        }
    }
    
    console.log("Yandex Maps initialized.");
}

/**
 * ФУНКЦИЯ ДЛЯ ПЛАВНОГО ПЕРЕКЛЮЧЕНИЯ РАЗДЕЛОВ (С АНИМАЦИЕЙ)
 */
window.showSection = function(sectionId) {
    const sections = document.querySelectorAll('.dashboard-section');
    
    // 1. Анимация: Плавное исчезновение текущего раздела
    let currentSection = null;
    sections.forEach(section => {
        if (section.classList.contains('active-tab')) {
            currentSection = section;
        }
    });

    // 2. Добавляем класс скрытия и анимацию (если есть что скрывать)
    if (currentSection && currentSection.id !== sectionId) {
        currentSection.classList.remove('active-tab'); 
        currentSection.style.opacity = '0';
        setTimeout(() => {
            currentSection.classList.add('hidden');
            
            // Запускаем показ нового раздела после скрытия старого
            showNewSection(sectionId);
            
        }, 250); // Время, чтобы анимация исчезновения прошла
    } else {
        // Если скрывать нечего или разделы совпадают, сразу показываем
        showNewSection(sectionId);
    }

    // 3. Функция показа нового раздела
    function showNewSection(id) {
        const targetSection = document.getElementById(id);
        if (targetSection) {
            targetSection.classList.remove('hidden');
            targetSection.classList.add('active-tab'); // Добавляем флаг активности
            
            // Плавное появление
            targetSection.style.opacity = '0'; 
            requestAnimationFrame(() => {
                targetSection.style.transition = 'opacity 0.3s ease-in-out';
                targetSection.style.opacity = '1'; 
            });

            // Обновляем активную кнопку-таб
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('bg-indigo-600', 'text-white', 'active');
                btn.classList.add('text-zinc-600', 'hover:bg-indigo-100');
            });
            const activeBtn = document.getElementById(`btn-${id}`);
            if (activeBtn) {
                activeBtn.classList.remove('text-zinc-600', 'hover:bg-indigo-100');
                activeBtn.classList.add('bg-indigo-600', 'text-white', 'active');
            }

            // Логика для карты Yandex
            if (id === 'map-view') {
                 // Принудительно подгоняем карту под размер контейнера после переключения
                window.mapInstance?.container.fitToViewport();
                
                // Загружаем данные для карты (если еще не загружены)
                if (window.loadMapData && window.mapInstance) {
                    window.loadMapData();
                } else if (!window.mapInstance) {
                    // Если карта не инициализирована, показываем загрузку
                    document.getElementById('mapLoading')?.classList.remove('hidden');
                }
            }
            
            // Если переключились на статистику, перерендерим графики
            if (id === 'stats' && window.renderAllCharts) {
                 window.renderAllCharts(window.latestReportData || []);
            }
            
            // Если переключились на сырые данные, обновим таблицу
            if (id === 'raw-data' && window.loadRawDataTable) {
                 window.loadRawDataTable(window.latestReportData || []);
            }

            lucide.createIcons();
        }
    }
}


/**
 * ФУНКЦИЯ ЗАГРУЗКИ ДАШБОРДА (Вызывается из admin_dashboard.html)
 */
window.loadDashboard = async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlRole = urlParams.get('role'); // Роль, переданная из index.html
    let initialView = urlParams.get('view') || 'form-view'; // Начальный раздел

    // 1. Проверяем аутентификацию
    const isAuthenticated = await window.checkAdminStatus(); 
    
    // 2. Обновляем информацию об авторизации в форме
    document.getElementById('authUsername').textContent = window.userTelegramUsername || 'Неизвестный';
    document.getElementById('authId').textContent = window.userTelegramId || '0';

    if (isAuthenticated) {
        
        // 3. Наполняем селекторы населенных пунктов
        if (window.SETTLEMENTS && document.getElementById('settlement')) {
            const settlementSelect = document.getElementById('settlement');
            const statsFilterSelect = document.getElementById('settlementStatsFilter');
            const mapFilterSelect = document.getElementById('settlementFilter');

            // Добавляем опцию "Все" для фильтров
            if (statsFilterSelect) statsFilterSelect.innerHTML = '<option value="all">Все населенные пункты</option>';
            if (mapFilterSelect) mapFilterSelect.innerHTML = '<option value="all">Все населенные пункты</option>';
            
            // Очищаем существующие опции
            settlementSelect.innerHTML = '<option value="">Выберите населенный пункт</option>';
            
            window.SETTLEMENTS.forEach(settlement => {
                // Для формы
                const optionForm = document.createElement('option');
                optionForm.value = settlement;
                optionForm.textContent = settlement;
                settlementSelect.appendChild(optionForm);
                
                // Для фильтра статистики
                const optionFilter = document.createElement('option');
                optionFilter.value = settlement;
                optionFilter.textContent = settlement;
                statsFilterSelect?.appendChild(optionFilter.cloneNode(true));
                mapFilterSelect?.appendChild(optionFilter.cloneNode(true));
            });
        }
        
        // 4. Настраиваем видимость табов в зависимости от роли
        if (window.isAdmin || urlRole === 'admin') {
            // Админ видит все
            document.getElementById('btn-map-view')?.classList.remove('hidden');
            document.getElementById('btn-stats')?.classList.remove('hidden');
            document.getElementById('btn-raw-data')?.classList.remove('hidden');
            document.getElementById('btn-my-reports-view')?.classList.remove('hidden');
            document.getElementById('exportCsvButton')?.classList.remove('hidden');
        } else {
            // Агитатор видит только Форму и Мои Отчеты
            document.getElementById('btn-map-view')?.classList.add('hidden');
            document.getElementById('btn-stats')?.classList.add('hidden');
            document.getElementById('btn-raw-data')?.classList.add('hidden');
            document.getElementById('exportCsvButton')?.classList.add('hidden');
            document.getElementById('btn-my-reports-view')?.classList.remove('hidden');
        }

        // 5. Выбор начального раздела
        let startSection = initialView;
        
        // Если пользователь Админ, по умолчанию показываем карту
        if (window.isAdmin && startSection === 'form-view') {
             startSection = 'map-view';
        }
        
        // Если Агитатор пришел на панель Админа, показываем форму/отчеты
        if (!window.isAdmin && (startSection === 'map-view' || startSection === 'stats' || startSection === 'raw-data')) {
             startSection = 'form-view';
        }

        // 6. Загрузка данных (для админов и агитаторов)
        if (window.loadReports) {
             await window.loadReports(window.isAdmin ? 'all' : 'my');
        }

        // 7. Отображение раздела
        window.showSection(startSection);
        document.getElementById('saveButton')?.removeAttribute('disabled');
        
    } else {
         window.showSection('form-view');
         document.getElementById('saveButton')?.setAttribute('disabled', 'true');
         window.showAlert('Доступ ограничен', 'Не удалось пройти аутентификацию. Используйте бота для входа.');
         document.getElementById('authUsername').textContent = 'Не авторизован';
         document.getElementById('authId').textContent = '—';
    }
}
