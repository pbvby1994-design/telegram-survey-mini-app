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
        if (loyaltyCounts.hasOwnProperty(r.loyalty)) {
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
// 2. ФУНКЦИЯ ЗАГРУЗКИ ДАННЫХ (Решает проблему "нет данных")
// ----------------------------------------------------------------------------------

/**
 * Загружает все записи из Firestore
 * @param {string | null} settlementFilter - Фильтр по населенному пункту
 */
window.fetchReports = async function(settlementFilter = null) {
    if (!window.db || !window.isAdmin) {
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
        }

    } catch (error) {
        console.error("Ошибка при загрузке отчетов: ", error);
        window.showAlert('ОШИБКА ДАННЫХ', `Не удалось загрузить отчеты: ${error.message}. Проверьте правила доступа в Firestore.`);
        document.getElementById('reportStatus').textContent = '❌ Ошибка загрузки данных';
    } finally {
        // mapLoading скрывается внутри initMapMarkers, если карта не может быть отображена
        if (!window.mapInstance) { 
            document.getElementById('mapLoading').classList.add('hidden');
        }
    }
}

// ----------------------------------------------------------------------------------
// 3. ИНТЕГРАЦИЯ YANDEX MAPS API
// ----------------------------------------------------------------------------------

/**
 * Инициализация Yandex Map. Вызывается один раз через 'onload' из HTML.
 */
window.initMap = function() {
    // Проверка, что Yandex Maps API загружен и карта еще не инициализирована
    if (typeof ymaps === 'undefined') {
        // Если API не загружен, ничего не делаем
        return; 
    }
    
    if (window.mapInstance) {
         // Если карта уже инициализирована, просто обновляем данные, если они нужны
         window.fetchReports(document.getElementById('settlementFilter').value || null);
         return;
    }
    
    // Стандартные координаты для центрирования (например, Сургутский район)
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

    // После инициализации карты загружаем данные
    window.fetchReports();
}

/**
 * Добавляет метки на Yandex Map, используя кластеризатор.
 */
window.initMapMarkers = function(reportList) {
    const mapContainer = document.getElementById('mapContainer');
    
    if (!window.mapInstance || !window.clusterer || typeof ymaps === 'undefined') {
        mapContainer.innerHTML = `<div class="p-6 text-gray-500 text-center text-lg">Ошибка загрузки Yandex Карт.</div>`;
        document.getElementById('mapLoading').classList.add('hidden');
        return;
    }

    window.clusterer.removeAll(); // Очистка старых меток
    const geoObjects = [];
    let hasGeoData = false;
    
    mapContainer.style.height = '600px'; 
    mapContainer.innerHTML = ''; // Очистка, если там было сообщение об ошибке
    
    reportList.forEach(r => {
        const lat = r.latitude;
        const lon = r.longitude;
        
        // Важно: проверяем наличие координат, сохраненных Dadata
        if (lat && lon) {
            hasGeoData = true;
            
            const color = (r.loyalty === 'strong') ? '#10b981' : 
                           (r.loyalty === 'moderate') ? '#3b82f6' : 
                           (r.loyalty === 'neutral') ? '#f59e0b' : 
                           '#ef4444'; 
                           
            const timestampText = r.timestamp ? new Date(r.timestamp.toDate()).toLocaleString('ru-RU') : 'N/A';
                           
            const placemark = new ymaps.Placemark([lat, lon], {
                balloonContentHeader: `<b>${r.settlement}</b>`,
                balloonContentBody: `Адрес: ${r.address}<br>Лояльность: ${r.loyalty}<br>Действие: ${r.action}<br>Дата: ${timestampText}`,
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
            window.mapInstance.setBounds(window.clusterer.getBounds(), {
                checkZoomRange: true,
                zoomMargin: 30
            });
        } catch (e) {
            // Игнорируем ошибку, если кластеризатор не имеет границ
        }
    } else {
        // Если нет данных с гео-координатами
        if (mapContainer.querySelector('#mapLoading')) mapContainer.querySelector('#mapLoading').remove();
        mapContainer.style.height = '200px'; 
        mapContainer.innerHTML = `<div class="p-6 text-gray-500 text-center text-lg">Нет данных с геолокацией для отображения на карте.</div>`;
    }
    
    document.getElementById('mapLoading').classList.add('hidden');
}


// ----------------------------------------------------------------------------------
// 4. ФУНКЦИЯ ЭКСПОРТА CSV
// ----------------------------------------------------------------------------------

window.exportToCsv = function() {
    // ... (логика экспорта CSV - см. предыдущий ответ) ...
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
        const safeValue = (v) => {
            const str = String(v || '').replace(/"/g, '""');
            return str.includes(';') || str.includes('\n') ? `"${str}"` : str;
        };
        
        const values = [
            safeValue(item.id),
            safeValue(item.telegramId),
            safeValue(formattedTimestamp),
            safeValue(item.settlement),
            safeValue(item.address),
            safeValue(item.loyalty),
            safeValue(item.action),
            safeValue(item.comment),
            safeValue(item.latitude),
            safeValue(item.longitude),
            safeValue(item.geo_lat_user),
            safeValue(item.geo_lon_user)
        ];
        csvRows.push(values.join(';'));
    });

    const csvString = csvRows.join('\n');
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
            // Убеждаемся, что fetchReports вызывается только для админов
            if (window.isAdmin) {
                window.fetchReports(selectedSettlement);
            }
        });
    }
});
