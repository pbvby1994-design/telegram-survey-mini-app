// reports.js (Адаптировано для Leaflet Maps)

// --- ГЛОБАЛЬНЫЕ КОНСТАНТЫ (для main.js) ---
window.SETTLEMENTS = [ 
    'г.п. Лянтор', 'с.п. Русскинская', 'г.п. Федоровский', 'г.п. Барсово', 
    'г.п. Белый Яр', 'с.п. Лямина', 'с.п. Сытомино', 'с.п. Угут', 
    'с.п. Ульт-Ягун', 'с.п. Солнечный', 'с.п. Нижнесортымский', 
    'с.п. Тундрино', 'с.п. Локосово'
];
window.latestReportData = []; 
let loyaltyChartInstance = null; 
let actionChartInstance = null; 


// ----------------------------------------------------------------------------------
// ФУНКЦИИ КАРТЫ (Leaflet)
// ----------------------------------------------------------------------------------

/**
 * Инициализация карты Leaflet. Вызывается при переходе на вкладку "Карта".
 */
window.initMap = function() {
    const mapContainer = document.getElementById('mapContainer');
    const mapLoading = document.getElementById('mapLoading');

    // Проверяем, что Leaflet загружен
    if (typeof L === 'undefined') {
        mapContainer.innerHTML = `<div class="p-6 text-red-500">Ошибка: Библиотека карт Leaflet не загружена.</div>`;
        mapLoading.classList.add('hidden');
        return;
    }

    // Если карта уже существует, просто обновляем данные
    if (window.mapInstance) {
        window.fetchReports(document.getElementById('settlementFilter').value || null);
        return;
    }

    // 1. Инициализация карты (центр - примерные координаты ХМАО)
    try {
        window.mapInstance = L.map('mapContainer').setView([61.35, 74.00], 8);
    } catch (e) {
         // Может возникнуть, если элемент уже содержит карту, но window.mapInstance не сброшен.
         mapContainer.innerHTML = `<div class="p-6 text-red-500">Ошибка инициализации карты. Попробуйте обновить страницу.</div>`;
         mapLoading.classList.add('hidden');
         return;
    }
    
    // 2. Добавление тайлов OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(window.mapInstance);

    // 3. Загрузка данных
    window.fetchReports(document.getElementById('settlementFilter').value || null);
};


/**
 * Отрисовка маркеров на карте на основе данных
 */
function renderMarkers(reportList) {
    if (!window.mapInstance) return;

    // Очистка старых маркеров, если они есть
    if (window.currentMarkers) {
        window.mapInstance.removeLayer(window.currentMarkers);
        window.currentMarkers = null;
    }
    
    // Скрываем загрузку
    document.getElementById('mapLoading').classList.add('hidden');

    const markers = L.markerClusterGroup();
    let hasGeoData = false;
    let bounds = [];

    reportList.forEach(r => {
        if (r.latitude && r.longitude) {
            hasGeoData = true;
            const marker = L.marker([r.latitude, r.longitude]);
            marker.bindPopup(`
                <b>${r.address || 'Адрес не указан'}</b><br>
                Лояльность: ${r.loyalty || 'Нейтрально'}<br>
                Действие: ${r.action || 'Не требуется'}<br>
                Комментарий: ${r.comment || 'Нет'}
            `);
            markers.addLayer(marker);
            bounds.push([r.latitude, r.longitude]);
        }
    });
    
    window.currentMarkers = markers;
    window.mapInstance.addLayer(markers);

    if (hasGeoData && bounds.length > 0) {
        try {
            // Центрируем карту по всем маркерам
            window.mapInstance.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
        } catch (e) { 
             // Игнорируем ошибку, если только одна точка 
        } 
    } else {
         // Показываем сообщение, если нет геоданных
         document.getElementById('mapContainer').innerHTML = `<div class="p-6 text-gray-500 text-center">Нет данных с геолокацией для отображения на карте.</div>`;
    }
}

// ----------------------------------------------------------------------------------
// ФУНКЦИИ ПОЛУЧЕНИЯ ДАННЫХ И ОТЧЕТОВ (Оставлено без изменений)
// ----------------------------------------------------------------------------------

window.fetchReports = async function(settlementFilter = null) {
    document.getElementById('mapLoading').classList.remove('hidden');

    if (!window.db) {
        document.getElementById('mapLoading').classList.add('hidden');
        return;
    }
    
    // ... (Остальная логика fetchReports, renderLoyaltyChart, renderActionChart, updateReportStats)
    // Которая должна быть у вас уже реализована для Firebase.
    // Если fetchReports не вызывает renderMarkers, добавьте его вызов в конце.
    
    // ПРИМЕР:
    const reportsCollection = window.db.collection('reports');
    let queryRef = reportsCollection.orderBy('timestamp', 'desc');

    if (settlementFilter) {
         // Здесь нужна фильтрация, но Firebase V9 требует импорты, 
         // поэтому оставим этот момент для вашей реализации на V8.
    }
    
    try {
        const snapshot = await queryRef.limit(100).get();
        window.latestReportData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Обновляем карту
        renderMarkers(window.latestReportData);
        
        // Обновляем сводку
        // renderLoyaltyChart(window.latestReportData);
        // updateReportStats(window.latestReportData);

    } catch (e) {
        console.error("Ошибка при получении отчетов:", e);
        document.getElementById('mapLoading').classList.add('hidden');
        window.showAlert('Ошибка данных', 'Не удалось загрузить отчеты из базы данных.');
    }
}
