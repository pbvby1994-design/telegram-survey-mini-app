// reports.js

// Импортируем необходимые переменные и функции из модуля аутентификации
import { db, isAdmin, getDocs, collection, query } from './firebase-auth.js';

// Переменные для карты и графиков
let loyaltyChartInstance = null;
let actionChartInstance = null; // НОВАЯ ПЕРЕМЕННАЯ
window.latestReportData = [];

// ----------------------------------------------------------------------------------
// ФУНКЦИИ ГРАФИКОВ
// ----------------------------------------------------------------------------------

function renderLoyaltyChart(reportList) {
    if (loyaltyChartInstance) {
        loyaltyChartInstance.destroy();
    }

    // 1. Агрегация данных
    const loyaltyCounts = {
        strong: 0,
        moderate: 0,
        neutral: 0,
        against: 0
    };
    reportList.forEach(report => {
        if (loyaltyCounts.hasOwnProperty(report.loyalty)) {
            loyaltyCounts[report.loyalty]++;
        }
    });

    // 2. Подготовка данных для Chart.js
    const labels = ['Сильная (ДА)', 'Умеренная (СКОРЕЕ ДА)', 'Нейтрально (НЕ ЗНАЮ)', 'Против (НЕТ)'];
    const data = [
        loyaltyCounts.strong,
        loyaltyCounts.moderate,
        loyaltyCounts.neutral,
        loyaltyCounts.against
    ];
    const backgroundColors = [
        '#10b981', // green-500 (strong)
        '#fcd34d', // amber-300 (moderate)
        '#9ca3af', // gray-400 (neutral)
        '#ef4444'  // red-500 (against)
    ];

    // 3. Создание графика
    const ctx = document.getElementById('loyaltyChart').getContext('2d');
    loyaltyChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { padding: 10 } },
                title: { display: false }
            }
        }
    });
}

function renderActionChart(reportList) {
    if (actionChartInstance) {
        actionChartInstance.destroy();
    }

    // 1. Агрегация данных
    const actionCounts = {};
    reportList.forEach(report => {
        const action = report.action || 'Не указано';
        actionCounts[action] = (actionCounts[action] || 0) + 1;
    });

    // 2. Подготовка данных для Chart.js
    const labels = Object.keys(actionCounts);
    const data = Object.values(actionCounts);
    const backgroundColors = labels.map(label => {
        if (label === 'Опрос') return '#22c55e'; // green-500
        if (label === 'Агитация') return '#3b82f6'; // blue-500
        if (label === 'Жалоба') return '#f97316'; // orange-500
        return '#9ca3af';
    });

    // 3. Создание графика
    const ctx = document.getElementById('actionChart').getContext('2d');
    actionChartInstance = new Chart(ctx, {
        type: 'bar', // Используем Bar Chart
        data: {
            labels: labels,
            datasets: [{
                label: 'Количество действий',
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { display: false },
                title: { display: false }
            }
        }
    });
}


// ----------------------------------------------------------------------------------
// ФУНКЦИЯ ЗАГРУЗКИ И ОТОБРАЖЕНИЯ ОТЧЕТОВ
// ----------------------------------------------------------------------------------

export async function fetchAndRenderReports() {
    if (!db || !isAdmin) {
         document.getElementById('reportsListContainer').innerHTML = `
            <div class="card p-6 text-red-500">
                <p>Доступ запрещен. Только администраторы могут просматривать отчеты.</p>
            </div>
        `;
        return;
    }

    // Показываем индикатор загрузки
    const reportsListContainer = document.getElementById('reportsListContainer');
    reportsListContainer.innerHTML = `
        <div class="card p-6 text-center text-gray-500">
            <i data-lucide="loader-2" class="w-8 h-8 mx-auto animate-spin"></i>
            <p class="mt-2">Загрузка отчетов...</p>
        </div>
    `;
    lucide.createIcons();

    try {
        const reportsCol = collection(db, "reports");
        const q = query(reportsCol);

        const reportSnapshot = await getDocs(q);
        const reportList = reportSnapshot.docs.map(doc => {
            const data = doc.data();
            // Обработка timestamp
            const timestampDate = data.timestamp && data.timestamp.toDate ? data.timestamp.toDate() : new Date();
            return {
                id: doc.id,
                date: timestampDate.toLocaleDateString('ru-RU'),
                time: timestampDate.toLocaleTimeString('ru-RU'),
                ...data
            };
        });

        // 1. СТРОИМ ГРАФИКИ
        renderLoyaltyChart(reportList);
        renderActionChart(reportList);

        // 2. Отображаем список
        const totalCount = reportList.length;

        if (totalCount === 0) {
             reportsListContainer.innerHTML = `<div class="card p-6 text-gray-500"><p>Отчетов пока нет.</p></div>`;
             return;
        }

        // Очищаем индикатор загрузки, показываем список
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

        // Сохраняем данные для функции карты
        window.latestReportData = reportList;

    } catch (e) {
        console.error("Error fetching reports: ", e);
        reportsListContainer.innerHTML = `<div class="card p-6 text-red-500">
            <h3 class="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Ошибка загрузки</h3>
            <p>Ошибка загрузки данных: ${e.message}</p>
            <p class="text-sm mt-2">Проверьте Правила Firestore.</p>
        </div>`;
    }
}

// ----------------------------------------------------------------------------------
// ФУНКЦИЯ КАРТЫ (Экспортируем для main.js)
// ----------------------------------------------------------------------------------

export function generateMap() {
    const mapContainer = document.getElementById('map');

    // Инициализация карты
    if (!window.map) {
         // Центр ХМАО
         window.map = L.map('map').setView([61.0, 73.0], 9);
         L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
         }).addTo(window.map);
    }

    // Очистка предыдущих маркеров
    if (window.currentMarkers) window.currentMarkers.clearLayers();

    // Добавление новых маркеров
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
    // Обновление размера карты
    setTimeout(() => window.map.invalidateSize(), 200);
}