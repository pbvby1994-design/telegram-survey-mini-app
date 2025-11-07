// reports.js

// Импортируем orderBy и другие функции/константы из firebase-auth.js
import { db, isAdmin, getDocs, collection, query, orderBy, where } from './firebase-auth.js'; 

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let loyaltyChartInstance = null; 
let actionChartInstance = null; 
let allReportsData = []; 
export const SETTLEMENTS = [ 
    'г.п. Лянтор', 'с.п. Русскинская', 'г.п. Федоровский', 'г.п. Барсово', 
    'г.п. Белый Яр', 'с.п. Лямина', 'с.п. Сытомино', 'с.п. Угут', 
    'с.п. Ульт-Ягун', 'с.п. Солнечный', 'с.п. Нижнесортымский', 
    'с.п. Тундрино', 'с.п. Локосово'
];
window.latestReportData = []; 

// ----------------------------------------------------------------------------------
// ФУНКЦИИ ГРАФИКОВ 
// ----------------------------------------------------------------------------------

function renderLoyaltyChart(reportList) {
    if (loyaltyChartInstance) {
        loyaltyChartInstance.destroy();
    }
    
    const loyaltyCounts = {
        strong: 0, moderate: 0, neutral: 0, against: 0
    };
    reportList.forEach(report => {
        if (loyaltyCounts.hasOwnProperty(report.loyalty)) {
            loyaltyCounts[report.loyalty]++;
        }
    });

    const labels = ['Сильная (ДА)', 'Умеренная (СКОРЕЕ ДА)', 'Нейтрально (НЕ ЗНАЮ)', 'Против (НЕТ)'];
    const data = [loyaltyCounts.strong, loyaltyCounts.moderate, loyaltyCounts.neutral, loyaltyCounts.against];
    const backgroundColors = ['#10b981', '#fcd34d', '#9ca3af', '#ef4444'];

    const ctx = document.getElementById('loyaltyChart').getContext('2d');
    loyaltyChartInstance = new Chart(ctx, {
        type: 'pie',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: backgroundColors, hoverOffset: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 10 } }, title: { display: false } } }
    });
}

function renderActionChart(reportList) {
    if (actionChartInstance) {
        actionChartInstance.destroy();
    }
    
    const actionCounts = {};
    reportList.forEach(report => {
        const action = report.action || 'Не указано';
        actionCounts[action] = (actionCounts[action] || 0) + 1;
    });

    const labels = Object.keys(actionCounts);
    const data = Object.values(actionCounts);
    const backgroundColors = labels.map(label => {
        if (label === 'Опрос') return '#22c55e';
        if (label === 'Агитация') return '#3b82f6';
        if (label === 'Жалоба') return '#f97316';
        return '#9ca3af';
    });

    const ctx = document.getElementById('actionChart').getContext('2d');
    actionChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'Количество действий', data: data, backgroundColor: backgroundColors, borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false }, title: { display: false } } }
    });
}


// ----------------------------------------------------------------------------------
// РЕНДЕРИНГ СПИСКА ОТЧЕТОВ
// ----------------------------------------------------------------------------------

function renderReportsList(reportList) {
    const reportsListContainer = document.getElementById('reportsListContainer');
    const totalCount = reportList.length;

    if (totalCount === 0) {
        reportsListContainer.innerHTML = `<div class="card p-6 text-gray-500"><p>Отчетов пока нет, или они не соответствуют выбранному фильтру.</p></div>`;
        return;
    }

    reportsListContainer.innerHTML = `
        <div class="card p-6 mt-4">
            <h3 class="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Детализация (${totalCount} записей)</h3>
            
            <div class="mt-4 space-y-3 max-h-[60vh] overflow-y-auto">
                ${reportList.map(r => 
                    `<div class="p-4 border rounded-lg shadow-sm bg-gray-50 transition duration-150 hover:shadow-md">
                        <div class="flex justify-between items-start mb-1">
                            <strong class="text-indigo-600">${r.settlement}</strong>
                            <span class="text-xs text-gray-500">${r.date} ${r.time}</span>
                        </div>
                        <p class="text-sm text-gray-800 mb-1">${r.address}</p>
                        <p class="text-xs">
                            Лояльность: 
                            <span class="font-medium ${r.loyalty === 'strong' ? 'text-green-600' : r.loyalty === 'against' ? 'text-red-600' : 'text-yellow-600'}">
                                ${r.loyalty}
                            </span> 
                            / Действие: <span class="font-medium text-blue-600">${r.action}</span>
                        </p>
                        ${r.comment ? `<p class="mt-2 text-sm italic text-gray-600 border-t pt-2">Комментарий: ${r.comment}</p>` : ''}
                    </div>`
                ).join('')}
            </div>
        </div>
    `;
    lucide.createIcons();
    
    window.latestReportData = reportList; 
}


// ----------------------------------------------------------------------------------
// ОСНОВНАЯ ФУНКЦИЯ ЗАГРУЗКИ ДАННЫХ 
// ----------------------------------------------------------------------------------

export async function fetchAndRenderReports() {
    if (!db || !isAdmin) {
         document.getElementById('reportsListContainer').innerHTML = `<div class="card p-6 text-red-500"><p>Доступ запрещен.</p></div>`;
        return;
    }
    
    const reportsListContainer = document.getElementById('reportsListContainer');
    reportsListContainer.innerHTML = `
        <div class="card p-6 text-center text-gray-500">
            <i data-lucide="loader-2" class="w-8 h-8 mx-auto animate-spin"></i>
            <p class="mt-2">Загрузка всех отчетов...</p>
        </div>
    `;
    lucide.createIcons();

    try {
        const reportsCol = collection(db, "reports");
        // СОРТИРОВКА по timestamp, от новых к старым
        const q = query(reportsCol, orderBy("timestamp", "desc")); 

        const reportSnapshot = await getDocs(q);
        allReportsData = reportSnapshot.docs.map(doc => { 
            const data = doc.data();
            const timestampDate = data.timestamp && data.timestamp.toDate ? data.timestamp.toDate() : new Date();
            return { 
                id: doc.id, 
                date: timestampDate.toLocaleDateString('ru-RU'),
                time: timestampDate.toLocaleTimeString('ru-RU'),
                ...data 
            };
        });
        
        populateReportFilter();
        
        // Рендерим все данные при первой загрузке
        filterAndRenderReports(); 

    } catch (e) {
        console.error("Error fetching reports: ", e);
        reportsListContainer.innerHTML = `<div class="card p-6 text-red-500">
            <p>Ошибка загрузки данных: ${e.message}</p>
        </div>`;
    }
}


// ----------------------------------------------------------------------------------
// ФУНКЦИИ ФИЛЬТРАЦИИ И ЭКСПОРТА
// ----------------------------------------------------------------------------------

function populateReportFilter() {
    const select = document.getElementById('reportSettlementFilter');
    select.innerHTML = '<option value="all">Все населенные пункты</option>';
    
    SETTLEMENTS.forEach(settlement => {
        const option = document.createElement('option');
        option.value = settlement;
        option.textContent = settlement;
        select.appendChild(option);
    });
}

export function filterAndRenderReports() {
    const filterValue = document.getElementById('reportSettlementFilter').value;
    let filteredReports = [];

    if (filterValue === 'all') {
        filteredReports = allReportsData;
    } else {
        filteredReports = allReportsData.filter(report => report.settlement === filterValue);
    }
    
    // 1. Строим графики по отфильтрованным данным
    renderLoyaltyChart(filteredReports); 
    renderActionChart(filteredReports);

    // 2. Рендерим список
    renderReportsList(filteredReports);
}

// ФУНКЦИЯ: ЭКСПОРТ В CSV
export function exportReportsToCSV() {
    if (!window.latestReportData || window.latestReportData.length === 0) {
        window.showAlert('Ошибка', 'Нет данных для экспорта. Загрузите отчеты.');
        return;
    }

    const reportList = window.latestReportData;
    
    // Определяем заголовки CSV
    const headers = [
        'ID Агитатора', 'Дата/Время', 'Населенный пункт', 'Адрес', 
        'Действие', 'Лояльность', 'Комментарий', 'Широта', 'Долгота'
    ].join(';');
    
    // Форматируем данные для CSV
    const csvRows = reportList.map(report => {
        return [
            `"${report.reporterId}"`, // В кавычках, чтобы избежать проблем с форматированием
            `"${report.date} ${report.time}"`,
            `"${report.settlement}"`,
            `"${report.address}"`,
            `"${report.action}"`,
            `"${report.loyalty}"`,
            `"${report.comment ? report.comment.replace(/"/g, '""') : ''}"`, // Экранирование кавычек
            report.latitude || '',
            report.longitude || ''
        ].join(';');
    });

    const csvContent = headers + '\n' + csvRows.join('\n');
    
    // Создаем Blob и ссылку для скачивания
    const blob = new Blob([
        // Добавляем BOM для корректного отображения кириллицы в Excel
        '\ufeff', 
        csvContent
    ], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Отчет_Агитатор_${new Date().toISOString().slice(0, 10)}.csv`;
    
    // Инициируем скачивание
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.showAlert('Успех', `Экспортировано ${reportList.length} записей в файл CSV.`);
}

// ----------------------------------------------------------------------------------
// ФУНКЦИЯ КАРТЫ
// ----------------------------------------------------------------------------------

export function generateMap() {
    const mapContainer = document.getElementById('map');
    
    if (!window.map) {
         window.map = L.map('map').setView([61.0, 73.0], 9); 
         L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
         }).addTo(window.map);
    }
    
    if (window.currentMarkers) window.currentMarkers.clearLayers();
    
    if (window.latestReportData && window.latestReportData.length > 0) {
        const markers = L.markerClusterGroup();
        let hasGeoData = false;
        window.latestReportData.forEach(r => {
            if (r.latitude && r.longitude) {
                hasGeoData = true;
                const marker = L.marker([r.latitude, r.longitude]);
                marker.bindPopup(`<b>${r.settlement}</b><br>${r.address}<br>Лояльность: ${r.loyalty}`);
                markers.addLayer(marker);
            }
        });
        
        if (hasGeoData) {
            window.currentMarkers = markers;
            window.map.addLayer(markers);
            try {
                window.map.fitBounds(markers.getBounds());
            } catch (e) { /* ignore error with one point */ }
           
        } else {
             mapContainer.innerHTML = `<div class="p-6 text-gray-500">Нет данных с геолокацией для отображения на карте.</div>`;
        }

    } else {
         mapContainer.innerHTML = `<div class="p-6 text-gray-500">Нет данных с геолокацией для отображения на карте.</div>`;
    }
    setTimeout(() => window.map.invalidateSize(), 200);
}
