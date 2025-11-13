// reports.js (АДАПТИРОВАНО ПОД YANDEX MAPS)

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let loyaltyChartInstance = null; 
let actionChartInstance = null; 
window.latestReportData = []; // Глобальный массив для данных
window.mapInstance = null;
window.clusterer = null;

const SETTLEMENTS = [ 
    'г.п. Лянтор', 'с.п. Русскинская', 'г.п. Федоровский', 'г.п. Барсово', 
    'г.п. Белый Яр', 'с.п. Лямина', 'с.п. Сытомино', 'с.п. Угут', 
    'с.п. Ульт-Ягун', 'с.п. Солнечный', 'с.п. Нижнесортымский', 
    'с.п. Тундрино', 'с.п. Локосово'
];


// ----------------------------------------------------------------------------------
// 1. ФУНКЦИИ ГРАФИКОВ (Chart.js) 
// ----------------------------------------------------------------------------------

function renderLoyaltyChart(reportList) {
    if (loyaltyChartInstance) loyaltyChartInstance.destroy();
    
    const loyaltyCounts = { strong: 0, moderate: 0, neutral: 0, against: 0 };
    reportList.forEach(r => {
        if (r.loyalty && loyaltyCounts.hasOwnProperty(r.loyalty)) {
            loyaltyCounts[r.loyalty]++;
        }
    });

    const ctx = document.getElementById('loyaltyChart').getContext('2d');
    loyaltyChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Сильная поддержка', 'Умеренная поддержка', 'Нейтрально', 'Против'],
            datasets: [{
                data: [loyaltyCounts.strong, loyaltyCounts.moderate, loyaltyCounts.neutral, loyaltyCounts.against],
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: 'Распределение лояльности' }
            }
        }
    });
}

function renderActionChart(reportList) {
    if (actionChartInstance) actionChartInstance.destroy();
    
    const actionCounts = {};
    reportList.forEach(r => {
        const action = r.action || 'Не указано';
        actionCounts[action] = (actionCounts[action] || 0) + 1;
    });

    const labels = Object.keys(actionCounts);
    const data = Object.values(actionCounts);
    
    const ctx = document.getElementById('actionChart').getContext('2d');
    actionChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Количество записей',
                data: data,
                backgroundColor: '#6366f1',
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Распределение по действиям' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}


// ----------------------------------------------------------------------------------
// 2. ФУНКЦИЯ ЗАГРУЗКИ ДАННЫХ
// ----------------------------------------------------------------------------------

/**
 * Загружает все записи из Firestore
 * @param {string | null} settlementFilter - Фильтр по населенному пункту
 */
window.fetchReports = async function(settlementFilter = null) {
    // Проверка, что пользователь администратор и база данных инициализирована
    if (!window.db || !window.isAdmin) {
         document.getElementById('reportStatus').textContent = '❌ Доступ только для администраторов.';
         document.getElementById('mapLoading').classList.add('hidden'); 
         return;
    }

    document.getElementById('reportStatus').textContent = '⏳ Загрузка данных...';
    document.getElementById('exportCsvButton').disabled = true;
    document.getElementById('mapLoading').classList.remove('hidden');

    try {
        let q = firebase.firestore().collection('reports');
        
        if (settlementFilter) {
            q = q.where('settlement', '==', settlementFilter);
        }
        
        q = q.orderBy('timestamp', 'desc');

        // Улучшение: Можно добавить .limit(1000) для ограничения большого объема данных
        const querySnapshot = await q.get();
        window.latestReportData = [];
        
        querySnapshot.forEach(doc => {
            window.latestReportData.push({ id: doc.id, ...doc.data() });
        });

        document.getElementById('reportStatus').textContent = `✅ Загружено записей: ${window.latestReportData.length}`;
        document.getElementById('exportCsvButton').disabled = window.latestReportData.length === 0;

        renderLoyaltyChart(window.latestReportData);
        renderActionChart(window.latestReportData);
        
        // Обновление карты, если она инициализирована
        if (window.mapInstance && typeof ymaps !== 'undefined') {
            window.initMapMarkers(window.latestReportData);
        } else {
            document.getElementById('mapLoading').classList.add('hidden'); 
        }

    } catch (error) {
        console.error("Ошибка при загрузке отчетов: ", error);
        window.showAlert('ОШИБКА ДАННЫХ', `Не удалось загрузить отчеты: ${error.message}. Проверьте правила доступа в Firestore.`);
        document.getElementById('reportStatus').textContent = '❌ Ошибка загрузки данных';
        document.getElementById('mapLoading').classList.add('hidden');
    }
}

// ----------------------------------------------------------------------------------
// 3. ИНТЕГРАЦИЯ YANDEX MAPS API
// ----------------------------------------------------------------------------------

/**
 * Инициализация Yandex Map. Вызывается один раз через 'onload' из HTML.
 */
window.initMap = function() {
    if (typeof ymaps === 'undefined' || window.mapInstance) {
        return; 
    }
    
    // Стандартные координаты для центрирования (Сургутский район)
    const defaultCoords = [61.644, 72.845]; 
    const defaultZoom = 8;

    window.mapInstance = new ymaps.Map('mapContainer', {
        center: defaultCoords,
        zoom: defaultZoom,
        controls: ['zoomControl', 'fullscreenControl']
    });

    window.clusterer = new ymaps.Clusterer({
        preset: 'islands#invertedVioletClusterIcons',
        groupByCoordinates: false,
        clusterDisableClickZoom: true,
        clusterHideIconOnZoom: true,
        geoObjectHideIconOnZoom: true
    });
    
    window.mapInstance.geoObjects.add(window.clusterer);

    // Только если пользователь админ, загружаем данные сразу
    if (window.isAdmin) {
        window.fetchReports();
    } else {
        document.getElementById('mapLoading').classList.add('hidden');
    }
}

/**
 * Добавляет метки на Yandex Map, используя кластеризатор.
 */
window.initMapMarkers = function(reportList) {
    const mapContainer = document.getElementById('mapContainer');
    
    if (!window.mapInstance || !window.clusterer || typeof ymaps === 'undefined') {
        mapContainer.style.height = '200px'; 
        mapContainer.innerHTML = `<div class="p-6 text-gray-500 text-center text-lg">Ошибка загрузки Yandex Карт.</div>`;
        document.getElementById('mapLoading').classList.add('hidden');
        return;
    }

    window.clusterer.removeAll(); // Очистка старых меток
    const geoObjects = [];
    let hasGeoData = false;
    
    mapContainer.style.height = '600px'; 
    
    reportList.forEach(r => {
        const lat = parseFloat(r.latitude);
        const lon = parseFloat(r.longitude);
        
        // Важно: проверяем, что Dadata вернула числовые координаты
        if (!isNaN(lat) && !isNaN(lon) && lat && lon) {
            hasGeoData = true;
            
            const color = (r.loyalty === 'strong') ? '#10b981' : 
                           (r.loyalty === 'moderate') ? '#3b82f6' : 
                           (r.loyalty === 'neutral') ? '#f59e0b' : 
                           '#ef4444'; 
                           
            const timestampText = r.timestamp ? new Date(r.timestamp.toDate()).toLocaleString('ru-RU') : 'N/A';
                           
            const placemark = new ymaps.Placemark([lat, lon], {
                balloonContentHeader: `<b>${r.settlement}</b>`,
                balloonContentBody: `Адрес: ${r.address}<br>Лояльность: ${r.loyalty}<br>Действие: ${r.action}<br>Дата: ${timestampText}<br>ID: ${r.telegramId}`,
                hintContent: r.address 
            }, {
                preset: 'islands#dotIcon',
                iconColor: color 
            });
            geoObjects.push(placemark);
        }
    });

    if (hasGeoData) {
        window.clusterer.add(geoObjects);
        try {
            // Центрирование карты по границам всех маркеров
            window.mapInstance.setBounds(window.clusterer.getBounds(), {
                checkZoomRange: true,
                zoomMargin: 30
            });
        } catch (e) {
             console.warn("Could not set bounds for map:", e);
        }
    } else {
        mapContainer.style.height = '200px'; 
        mapContainer.innerHTML = `<div class="p-6 text-gray-500 text-center text-lg">Нет данных с геолокацией для отображения на карте.</div>`;
    }
    
    document.getElementById('mapLoading').classList.add('hidden');
}


// ----------------------------------------------------------------------------------
// 4. ФУНКЦИЯ ЭКСПОРТА CSV (Улучшенная обработка)
// ----------------------------------------------------------------------------------

/**
 * Экранирует строку для CSV (заменяет кавычки и оборачивает в кавычки, если есть разделитель)
 */
function safeCsvValue(v) {
    const str = String(v || '').replace(/"/g, '""'); // Экранирование двойных кавычек
    // Оборачиваем в кавычки, если есть разделитель (;) или перенос строки
    return str.includes(';') || str.includes('\n') ? `"${str}"` : str;
};

window.exportToCsv = function() {
    const data = window.latestReportData;
    if (data.length === 0) {
        window.showAlert('ОШИБКА', 'Нет данных для экспорта.');
        return;
    }

    const headers = [
        "ID", "Telegram ID", "Дата", "Населенный пункт", "Адрес", 
        "Лояльность", "Действие", "Комментарий", "Широта (Dadata)", "Долгота (Dadata)", "Широта (GPS)", "Долгота (GPS)"
    ];
    
    const csvRows = [headers.join(';')];
    
    data.forEach(item => {
        const formattedTimestamp = item.timestamp ? new Date(item.timestamp.toDate()).toLocaleString('ru-RU') : '';
        
        const values = [
            safeCsvValue(item.id),
            safeCsvValue(item.telegramId),
            safeCsvValue(formattedTimestamp),
            safeCsvValue(item.settlement),
            safeCsvValue(item.address),
            safeCsvValue(item.loyalty),
            safeCsvValue(item.action),
            safeCsvValue(item.comment),
            safeCsvValue(item.latitude),
            safeCsvValue(item.longitude),
            safeCsvValue(item.geo_lat_user),
            safeCsvValue(item.geo_lon_user)
        ];
        csvRows.push(values.join(';'));
    });

    const csvString = csvRows.join('\n');
    // Добавление BOM для корректного отображения кириллицы в Excel
    const blob = new Blob(["\ufeff" + csvString], { type: 'text/csv;charset=utf-8;' }); 
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', 'reports_' + new Date().toISOString().slice(0, 10) + '.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.showAlert('УСПЕХ', 'Данные успешно экспортированы в CSV.');
}

// ----------------------------------------------------------------------------------
// 5. ИНИЦИАЛИЗАЦИЯ ФИЛЬТРА
// ----------------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    const filterSelect = document.getElementById('settlementFilter');
    if (filterSelect) {
        SETTLEMENTS.forEach(s => {
            const option = document.createElement('option');
            option.value = s;
            option.textContent = s;
            filterSelect.appendChild(option);
        });
        
        filterSelect.addEventListener('change', (e) => {
            const selectedSettlement = e.target.value === '' ? null : e.target.value;
            // Вызываем fetchReports только если админ
            if (window.isAdmin) {
                window.fetchReports(selectedSettlement);
            }
        });
    }
});
