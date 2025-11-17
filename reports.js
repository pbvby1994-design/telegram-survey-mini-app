// reports.js (ИСПРАВЛЕННАЯ ВЕРСИЯ - СИНТАКСИС GLOBAL)

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let loyaltyChartInstance = null; 
let actionChartInstance = null; 
// Использование window для доступа из других файлов
window.SETTLEMENTS = [ 
    'г.п. Лянтор', 'с.п. Русскинская', 'г.п. Федоровский', 'г.п. Барсово', 
    'г.п. Белый Яр', 'с.п. Лямина', 'с.п. Сытомино', 'с.п. Угут', 
    'с.п. Ульт-Ягун', 'с.п. Солнечный', 'с.п. Нижнесортымский', 
    'с.п. Тундрино', 'с.п. Локосово'
];
window.latestReportData = []; 
window.activeReportsQuery = null; 

// --- УТИЛИТА: Управление видимостью Chart.js и сообщения об отсутствии данных ---
function updateChartVisibility(chartId, noDataMsgId, hasData) {
    const chart = document.getElementById(chartId);
    const msg = document.getElementById(noDataMsgId);
    if (chart) chart.classList.toggle('hidden', !hasData);
    if (msg) {
        msg.textContent = 'Нет данных для построения графика.';
        msg.classList.toggle('hidden', hasData);
    }
}

// --- ГРАФИКИ: Обработка данных для Chart.js ---

/**
 * Строит или обновляет круговую диаграмму лояльности.
 * @param {Array<Object>} reports Список отчетов.
 */
function renderLoyaltyChart(reports) {
    const counts = { 'Высокая': 0, 'Нейтральная': 0, 'Низкая': 0 };
    reports.forEach(r => {
        if (r.loyalty && counts.hasOwnProperty(r.loyalty)) {
            counts[r.loyalty]++;
        }
    });

    const hasData = Object.values(counts).some(count => count > 0);
    updateChartVisibility('loyaltyChart', 'loyaltyNoData', hasData);

    if (!hasData) {
        if (loyaltyChartInstance) {
            loyaltyChartInstance.destroy();
            loyaltyChartInstance = null;
        }
        return;
    }

    const data = {
        labels: ['Высокая', 'Нейтральная', 'Низкая'],
        datasets: [{
            data: [counts['Высокая'], counts['Нейтральная'], counts['Низкая']],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'], // green, yellow, red
            hoverOffset: 4
        }]
    };

    if (loyaltyChartInstance) {
        loyaltyChartInstance.data = data;
        loyaltyChartInstance.update();
    } else {
        const ctx = document.getElementById('loyaltyChart').getContext('2d');
        loyaltyChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    title: {
                        display: false,
                    }
                }
            }
        });
    }
}

/**
 * Строит или обновляет столбчатую диаграмму действий.
 * @param {Array<Object>} reports Список отчетов.
 */
function renderActionChart(reports) {
    const counts = {};
    reports.forEach(r => {
        if (r.action) {
            counts[r.action] = (counts[r.action] || 0) + 1;
        }
    });

    const hasData = Object.values(counts).some(count => count > 0);
    updateChartVisibility('actionChart', 'actionNoData', hasData);

    if (!hasData) {
        if (actionChartInstance) {
            actionChartInstance.destroy();
            actionChartInstance = null;
        }
        return;
    }

    const labels = Object.keys(counts);
    const data = {
        labels: labels,
        datasets: [{
            label: 'Количество',
            data: Object.values(counts),
            backgroundColor: '#4f46e5', // indigo-600
            borderRadius: 4
        }]
    };

    if (actionChartInstance) {
        actionChartInstance.data = data;
        actionChartInstance.update();
    } else {
        const ctx = document.getElementById('actionChart').getContext('2d');
        actionChartInstance = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
}

// --- КАРТА: Инициализация и отображение меток ---

/**
 * Инициализация Яндекс.Карты.
 */
window.initMap = function() {
    if (typeof ymaps === 'undefined') {
        console.error("Yandex Maps API not loaded.");
        return;
    }

    // Инициализация карты (центр: Сургутский район, ХМАО)
    window.mapInstance = new ymaps.Map("map", {
        center: [61.25, 73.40], // Примерный центр Сургутского района
        zoom: 7,
        controls: ['zoomControl', 'fullscreenControl', 'rulerControl']
    });
    
    // После инициализации карты загружаем данные
    if (window.latestReportData && window.latestReportData.length > 0) {
        renderPlacemarks(window.latestReportData);
    }
}

/**
 * Отображает метки на Яндекс.Карте.
 * @param {Array<Object>} reports Список отчетов.
 */
function renderPlacemarks(reports) {
    if (!window.mapInstance || typeof ymaps === 'undefined') {
        window.latestReportData = reports; // Сохраняем данные для отрисовки после загрузки карты
        return;
    }
    
    // Очищаем предыдущие объекты
    window.mapInstance.geoObjects.removeAll();

    const reportsWithCoords = reports.filter(r => r.latitude && r.longitude);

    if (reportsWithCoords.length === 0) {
        console.warn("Нет отчетов с координатами для отображения на карте.");
        return;
    }

    const placemarks = reportsWithCoords.map(r => {
        // Определение цвета метки по лояльности
        let loyaltyColor;
        let loyaltyText = r.loyalty || 'Не указано';
        switch (r.loyalty) {
            case 'Высокая':
                loyaltyColor = 'green';
                break;
            case 'Нейтральная':
                loyaltyColor = 'yellow';
                break;
            case 'Низкая':
                loyaltyColor = 'red';
                break;
            default:
                loyaltyColor = 'gray';
        }

        const date = r.timestamp instanceof firebase.firestore.Timestamp 
            ? r.timestamp.toDate() 
            : (r.timestamp ? new Date(r.timestamp) : new Date());

        // Формирование контента для балуна (всплывающего окна)
        const content = `
                <div class="p-2">
                    <h4 class="font-bold mb-1">${r.address || r.settlement}</h4>
                    <p class="text-sm">Лояльность: <span class="font-semibold">${loyaltyText}</span></p>
                    <p class="text-sm">Действие: ${r.action || '—'}</p>
                    <p class="text-xs text-gray-500 mt-1">${date.toLocaleString('ru-RU')}</p>
                    ${r.comment ? `<p class="text-xs text-gray-700 mt-2 italic">Комментарий: ${r.comment}</p>` : ''}
                    <p class="text-xs text-gray-500 mt-2">Агитатор: ${r.username || r.user_id}</p>
                </div>
            `;

        return new ymaps.Placemark([r.latitude, r.longitude], {
            // Данные для отображения в балуне
            balloonContentBody: content,
            hintContent: `${r.settlement} - ${loyaltyText}`
        }, {
            // Опции метки
            preset: `islands#${loyaltyColor}DotIcon`
        });
    });

    if (placemarks.length > 0) {
        const clusterer = new ymaps.Clusterer({
            preset: 'islands#invertedVioletClusterIcons',
            groupByCoordinates: false,
            clusterDisableClickZoom: true,
            clusterOpenBalloonOnClick: true,
            clusterBalloonContentLayout: 'cluster#balloonCarousel'
        });
        
        clusterer.add(placemarks);
        window.mapInstance.geoObjects.add(clusterer);

        // Масштабирование до всех меток
        window.mapInstance.setBounds(clusterer.getBounds(), {
            checkZoomRange: true, 
            duration: 500
        }).then(() => {
            // Ограничение минимального зума после зумирования до кластеров
            if (window.mapInstance.getZoom() > 14) {
                 window.mapInstance.setZoom(14, {duration: 300});
            }
        });
    }
}

// --- ЗАГРУЗКА ДАННЫХ И ФИЛЬТРАЦИЯ ---

/**
 * Загружает и фильтрует данные отчетов из Firestore.
 * @param {'all'|'my'} userFilter Фильтр по пользователю.
 * @param {string} settlementFilter Фильтр по населенному пункту.
 */
window.loadReports = async function(userFilter = 'all', settlementFilter = 'all') {
    if (!window.db) {
        console.error("Firestore DB not initialized.");
        return;
    }
    
    let query = window.db.collection('reports').orderBy('timestamp', 'desc');

    // 1. Фильтр по пользователю
    if (userFilter === 'my' && window.userTelegramId) {
        query = query.where('user_id', '==', window.userTelegramId);
    }
    
    // 2. Фильтр по населенному пункту
    if (settlementFilter !== 'all') {
        query = query.where('settlement', '==', settlementFilter);
    }
    
    window.activeReportsQuery = query;

    try {
        const snapshot = await query.get();
        const reports = snapshot.docs.map(doc => doc.data());
        
        // Сохраняем данные глобально
        window.latestReportData = reports;

        // Рендеринг всех компонентов
        renderLoyaltyChart(reports);
        renderActionChart(reports);
        renderPlacemarks(reports);
        populateFilterOptions(reports);
        
    } catch (e) {
        console.error("Error fetching reports:", e);
        window.showAlert('Ошибка Загрузки', `Не удалось загрузить отчеты: ${e.message}`);
    }
}

/**
 * Заполняет выпадающие списки фильтров уникальными значениями.
 * @param {Array<Object>} reports Список отчетов.
 */
function populateFilterOptions(reports) {
    const settlementFilter = document.getElementById('filterSettlement');
    const userFilter = document.getElementById('filterUser');
    
    // 1. Фильтр по населенному пункту
    // Очищаем, оставляя только "Все"
    settlementFilter.innerHTML = '<option value="all">Все</option>';
    
    // Используем предопределенный список, т.к. он полный
    window.SETTLEMENTS.forEach(settlement => {
        const option = document.createElement('option');
        option.value = settlement;
        option.textContent = settlement;
        settlementFilter.appendChild(option);
    });

    // 2. Фильтр по пользователю (только если админ)
    if (window.isAdmin) {
        // Очищаем, оставляя только "Все" и "Мои Отчеты"
        userFilter.innerHTML = '<option value="all">Все</option><option value="my">Мои Отчеты</option>';
        
        const uniqueUsers = Array.from(new Set(reports.map(r => r.username || r.user_id)));
        
        uniqueUsers.forEach(user => {
            if (user) {
                const option = document.createElement('option');
                option.value = user;
                option.textContent = user;
                userFilter.appendChild(option);
            }
        });
    }
}

/**
 * Инициализация дашборда после загрузки DOM.
 */
window.loadDashboard = function() {
    // Установка начальных фильтров
    const filterSettlement = document.getElementById('filterSettlement');
    const filterUser = document.getElementById('filterUser');
    const applyFiltersButton = document.getElementById('applyFiltersButton');

    // Назначаем обработчик для кнопки "Применить"
    if (applyFiltersButton) {
        applyFiltersButton.addEventListener('click', () => {
            const selectedSettlement = filterSettlement.value;
            const selectedUser = filterUser.value;
            
            // Если выбран пользователь по username, ищем его ID
            let finalUserFilter = selectedUser;
            if (selectedUser !== 'all' && selectedUser !== 'my' && window.latestReportData.length > 0) {
                 const report = window.latestReportData.find(r => (r.username === selectedUser || r.user_id === selectedUser));
                 finalUserFilter = report ? report.user_id : 'all';
            }
            
            window.loadReports(finalUserFilter === 'my' ? 'my' : finalUserFilter, selectedSettlement);
        });
    }

    // Загрузка всех отчетов при старте
    window.loadReports();
}
