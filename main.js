// main.js (ФИНАЛЬНАЯ ВЕРСИЯ С АНИМАЦИЯМИ - СИНТАКСИЧЕСКИ ПРОВЕРЕНО)

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
        document.getElementById('addressStatus').textContent = '⚠️ Координаты для этого адреса отсутствуют.';
    }
}

/**
 * Обработчик отправки формы
 */
document.getElementById('reportForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Блокируем кнопку на время отправки
    document.getElementById('saveButton').setAttribute('disabled', 'true');
    document.getElementById('saveButton').innerHTML = '<svg data-lucide="loader" class="w-5 h-5 animate-spin"></svg> <span>Отправка...</span>';
    lucide.createIcons();
    
    const timestamp = new Date();
    const settlement = document.getElementById('settlement').value;
    const address = document.getElementById('address').value;
    const loyalty = document.querySelector('input[name="loyalty"]:checked').value;
    const action = document.getElementById('action').value;
    const comment = document.getElementById('comment').value;

    let latitude = dadataCoords ? dadataCoords.lat : null;
    let longitude = dadataCoords ? dadataCoords.lon : null;

    // Если нет координат из Dadata, пытаемся получить геолокацию
    if (!latitude || !longitude) {
        try {
             // Используем нативную геолокацию
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, enableHighAccuracy: true });
            });
            latitude = position.coords.latitude;
            longitude = position.coords.longitude;
            window.showAlert('Геолокация', 'Использованы координаты телефона.');
        } catch (error) {
            console.warn("Geolocation failed:", error);
            window.showAlert('Ошибка координат', 'Не удалось получить координаты из Dadata или геолокации. Отчет будет сохранен без координат.');
        }
    }
    
    // Объект данных для Firestore
    const reportData = {
        timestamp: timestamp,
        user_id: window.userTelegramId,
        username: window.userTelegramUsername,
        settlement: settlement,
        address: address,
        loyalty: loyalty,
        action: action,
        comment: comment,
        latitude: latitude,
        longitude: longitude
    };

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
        document.getElementById('reportForm').reset();
        document.getElementById('addressStatus').textContent = '';
        dadataCoords = null; // Сброс координат
        
        // 3. Обновление Моих Отчетов, если мы на вкладке
        if (window.updateMyReportsView) {
             window.updateMyReportsView();
        }
        
    } catch (error) {
        console.error("Error writing document: ", error);
        window.showAlert('Ошибка Firebase', `Не удалось сохранить отчет: ${error.message}. Проверьте правила безопасности.`);
    } finally {
        // Разблокируем кнопку
        document.getElementById('saveButton').removeAttribute('disabled');
        document.getElementById('saveButton').innerHTML = '<svg data-lucide="send" class="w-5 h-5"></svg> <span>Сохранить отчет</span>';
        lucide.createIcons();
    }
});

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
    if (document.getElementById('map-view').classList.contains('active-tab')) {
        if (window.loadMapData) {
            window.loadMapData(); 
        }
    }
    
    console.log("Yandex Maps initialized.");
}

/**
 * ФУНКЦИЯ ДЛЯ ПЛАВНОГО ПЕРЕКЛЮЧЕНИЯ РАЗДЕЛОВ (ОБНОВЛЕННАЯ С АНИМАЦИЕЙ)
 */
window.showSection = function(sectionId) {
    const sections = document.querySelectorAll('.dashboard-section');
    
    // 1. Анимация: Плавное исчезновение текущего раздела
    let currentSection = null;
    sections.forEach(section => {
        section.classList.remove('active-tab'); // Убираем флаг активности
        if (!section.classList.contains('hidden') && section.id !== sectionId) {
            currentSection = section;
        }
    });

    // 2. Добавляем класс скрытия и анимацию (если есть что скрывать)
    if (currentSection) {
        currentSection.style.opacity = '0';
        setTimeout(() => {
            currentSection.classList.add('hidden');
            
            // Запускаем показ нового раздела после скрытия старого
            showNewSection(sectionId);
            
        }, 250); // Время, чтобы анимация исчезновения прошла
    } else {
        // Если скрывать нечего, сразу показываем
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
                statsFilterSelect?.appendChild(optionFilter);
            });
        }
        
        // 4. Настраиваем видимость табов в зависимости от роли
        if (window.isAdmin || urlRole === 'admin') {
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
