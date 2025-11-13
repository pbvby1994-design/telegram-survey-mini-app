// reports.js (ИСПРАВЛЕННАЯ ВЕРСИЯ - СИНТАКСИС GLOBAL)

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let loyaltyChartInstance = null; 
let actionChartInstance = null; 
let allReportsData = []; 

// Список НП для фильтров
window.SETTLEMENTS = [ 
    'г.п. Лянтор', 'с.п. Русскинская', 'г.п. Федоровский', 'г.п. Барсово', 
    'г.п. Белый Яр', 'с.п. Лямина', 'с.п. Сытомино', 'с.п. Угут', 
    'с.п. Ульт-Ягун', 'с.п. Солнечный', 'с.п. Нижнесортымский', 
    'с.п. Тундрино', 'с.п. Локосово'
];
window.latestReportData = []; // Для хранения последних отчетов текущего пользователя
window.activeReportsQuery = null; 

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
    
    reportList.forEach(r => {
        if (loyaltyCounts.hasOwnProperty(r.loyalty)) {
            loyaltyCounts[r.loyalty]++;
        }
    });

    const data = {
        labels: ['Сильная поддержка', 'Умеренная поддержка', 'Нейтрально', 'Против'],
        datasets: [{
            data: [loyaltyCounts.strong, loyaltyCounts.moderate, loyaltyCounts.neutral, loyaltyCounts.against],
            backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'], // Green, Blue, Amber, Red
        }]
    };

    loyaltyChartInstance = new Chart(
        document.getElementById('loyaltyChart'),
        {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: false,
                    }
                }
            }
        }
    );
}

function renderActionChart(reportList) {
     if (actionChartInstance) {
        actionChartInstance.destroy();
    }

    const actionCounts = {
        call: 0, visit: 0, leaflet: 0, contact: 0
    };
    
    reportList.forEach(r => {
        if (actionCounts.hasOwnProperty(r.action)) {
            actionCounts[r.action]++;
        }
    });

    const data = {
        labels: ['Звонок', 'Визит/Обход', 'Раздача листовок', 'Передан контакт'],
        datasets: [{
            label: 'Количество действий',
            data: [actionCounts.call, actionCounts.visit, actionCounts.leaflet, actionCounts.contact],
            backgroundColor: [
                '#a855f7', // Purple
                '#60a5fa', // Light Blue
                '#f472b6', // Pink
                '#34d399'  // Teal
            ],
        }]
    };
    
    actionChartInstance = new Chart(
        document.getElementById('actionChart'),
        {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        display: false,
                    }
                }
            }
        }
    );
}

/**
 * Рендеринг данных в таблице для вкладки "Сырые данные"
 */
function renderRawData(reportList) {
    const tableBody = document.getElementById('reportsTableBody');
    const dataCount = document.getElementById('dataCount');
    tableBody.innerHTML = '';
    
    if (reportList.length === 0) {
         tableBody.innerHTML = '<tr><td colspan="6" class="px-3 py-4 text-sm text-gray-500 text-center">Нет данных для отображения.</td></tr>';
         dataCount.textContent = 'Всего отчетов: 0';
         return;
    }
    
    reportList.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
    
    reportList.forEach(r => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150';
        
        const timestamp = r.timestamp ? new Date(r.timestamp.seconds * 1000).toLocaleString('ru-RU') : 'Нет даты';

        row.innerHTML = `
            <td class="px-3 py-2 whitespace-nowrap text-sm">${timestamp}</td>
            <td class="px-3 py-2 whitespace-nowrap text-sm">${r.username || r.user_id}</td>
            <td class="px-3 py-2 text-sm">${r.settlement}, ${r.address}</td>
            <td class="px-3 py-2 whitespace-nowrap text-sm">${r.loyalty}</td>
            <td class="px-3 py-2 whitespace-nowrap text-sm">${r.action}</td>
            <td class="px-3 py-2 text-sm max-w-[200px] truncate">${r.comment}</td>
        `;
        tableBody.appendChild(row);
    });
    
    dataCount.textContent = `Всего отчетов: ${reportList.length}`;
}

/**
 * Рендеринг данных на карте (Только для Админа)
 */
function renderMap(reportList) {
    if (!window.mapInstance) return; // Карта не инициализирована
    
    // Очистка предыдущих меток
    window.mapInstance.geoObjects.removeAll();

    const objectManager = new ymaps.ObjectManager();
    window.mapInstance.geoObjects.add(objectManager);
    
    const features = reportList
        .filter(r => r.latitude && r.longitude) // Только отчеты с координатами
        .map(r => {
            let color = '#3b82f6'; // Blue
            if (r.loyalty === 'strong') color = '#10b981'; // Green
            else if (r.loyalty === 'against') color = '#ef4444'; // Red

            return {
                type: 'Feature',
                id: r.id,
                geometry: {
                    type: 'Point',
                    coordinates: [r.latitude, r.longitude]
                },
                properties: {
                    balloonContentHeader: `Отчет: ${r.settlement}, ${r.address}`,
                    balloonContentBody: `
                        <p><strong>Лояльность:</strong> ${r.loyalty}</p>
                        <p><strong>Действие:</strong> ${r.action}</p>
                        <p><strong>Агитатор:</strong> ${r.username || r.user_id}</p>
                        <p><strong>Комментарий:</strong> ${r.comment}</p>
                        <p><strong>Дата:</strong> ${new Date(r.timestamp.seconds * 1000).toLocaleString('ru-RU')}</p>
                    `,
                    iconCaption: r.settlement,
                },
                options: {
                    preset: 'islands#circleIcon',
                    iconColor: color
                }
            };
        });

    objectManager.add(features);
    
    // Автозум и центрирование по всем меткам
    if (features.length > 0) {
        window.mapInstance.setBounds(objectManager.getBounds(), {
            checkZoomRange: true,
            zoomMargin: 15
        });
    }
}

/**
 * Рендеринг последних отчетов для вкладки "Мои Отчеты"
 */
function renderMyReports(reportList) {
    const listContainer = document.getElementById('myReportsList');
    listContainer.innerHTML = '';
    
    if (reportList.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-400">Вы пока не сохранили ни одного отчета.</p>';
        return;
    }
    
    reportList
        .sort((a, b) => b.timestamp.seconds - a.timestamp.seconds) // Сортируем по дате
        .slice(0, 10) // Берем только последние 10
        .forEach(r => {
            const loyaltyColor = r.loyalty === 'strong' ? 'bg-green-100 text-green-800' :
                                 r.loyalty === 'against' ? 'bg-red-100 text-red-800' :
                                 'bg-blue-100 text-blue-800';
                                 
            const timestamp = r.timestamp ? new Date(r.timestamp.seconds * 1000).toLocaleString('ru-RU') : 'Нет даты';
            
            const card = document.createElement('div');
            card.className = 'p-4 border rounded-lg shadow-sm bg-gray-50 dark:bg-gray-700';
            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <p class="text-sm font-semibold">${r.settlement}, ${r.address}</p>
                    <span class="text-xs font-medium px-2 py-0.5 rounded-full ${loyaltyColor}">${r.loyalty}</span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400">${timestamp}</p>
                <p class="text-sm mt-1">Действие: ${r.action}</p>
                <p class="text-sm mt-1">Комментарий: ${r.comment.length > 80 ? r.comment.substring(0, 80) + '...' : r.comment}</p>
            `;
            listContainer.appendChild(card);
        });
}

// ----------------------------------------------------------------------------------
// ОСНОВНЫЕ ФУНКЦИИ ЗАГРУЗКИ
// ----------------------------------------------------------------------------------

/**
 * ЗАГЛУШКА. Функция для загрузки всех отчетов из Firestore.
 * @param {string|null} settlement - Фильтр по населенному пункту.
 * @param {boolean} isMapUpdate - Флаг, указывающий, что требуется обновление карты (для админа).
 */
window.fetchReports = async function(settlement = null, isMapUpdate = false) {
    if (!window.db || !window.userTelegramId) {
        console.error("Firestore или ID пользователя не инициализированы.");
        return;
    }
    
    // Текущий активный раздел для рендеринга
    const currentSection = document.querySelector('.section:not(.hidden)')?.id;

    try {
        let reportsRef = window.db.collection('reports');
        let query;
        
        if (window.isAdmin) {
            // Администратор: фильтруем по НП, если указан
            query = settlement ? reportsRef.where('settlement', '==', settlement) : reportsRef;
        } else {
            // Агитатор: фильтруем только по своему ID
            query = reportsRef.where('user_id', '==', window.userTelegramId);
        }

        const snapshot = await query.get();
        const reportList = [];
        
        snapshot.forEach(doc => {
            reportList.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Сохраняем все данные для экспорта/анализа (если Админ)
        if (window.isAdmin) {
             allReportsData = reportList; 
        } else {
             window.latestReportData = reportList;
        }
        
        // Рендеринг данных в соответствии с текущей вкладкой
        if (currentSection === 'stats') {
            renderLoyaltyChart(reportList);
            renderActionChart(reportList);
        } else if (currentSection === 'raw-data') {
            renderRawData(reportList);
        } else if (currentSection === 'map-view' || isMapUpdate) {
             // Карта рендерится только для Админа
            renderMap(reportList); 
        } else if (currentSection === 'my-reports-view' || !window.isAdmin) {
            // Мои отчеты для Агитатора или принудительная загрузка после сохранения
            renderMyReports(reportList);
        }
        
    } catch (error) {
        console.error("Ошибка при загрузке отчетов:", error);
        window.showAlert('Ошибка Загрузки', 'Не удалось загрузить отчеты из базы данных.');
    }
}


/**
 * ЗАГЛУШКА. Функция для инициализации админ-панели (заполнение фильтров и т.д.)
 */
window.loadDashboard = function() {
    // 1. Заполняем фильтры населенных пунктов на всех вкладках админа
    const filters = [
        document.getElementById('settlementFilter'),
        document.getElementById('settlementStatsFilter'),
        document.getElementById('settlementRawDataFilter')
    ];
    
    filters.forEach(filter => {
        if (filter) {
             // Очищаем, кроме первого элемента "Все НП"
            filter.querySelectorAll('option:not(:first-child)').forEach(o => o.remove()); 
            
            window.SETTLEMENTS.forEach(settlement => {
                const option = document.createElement('option');
                option.value = settlement;
                option.textContent = settlement;
                filter.appendChild(option);
            });
        }
    });

    // 2. Первоначальная загрузка данных при запуске, если находимся не на карте
    const currentSection = document.querySelector('.section:not(.hidden)')?.id;
    if (currentSection && currentSection !== 'map-view') {
        window.fetchReports(null); 
    }
}

/**
 * Экспорт всех отчетов в CSV (доступно только для Админа).
 */
window.exportToCsv = function() {
    if (allReportsData.length === 0) {
         window.showAlert('Ошибка экспорта', 'Нет данных для экспорта. Сначала загрузите данные.');
         return;
    }
    
    // Заголовки для CSV
    const headers = [
        'ID', 'Дата', 'Username', 'User ID', 'НП', 'Адрес', 'Лояльность', 'Действие', 'Комментарий', 'Latitude', 'Longitude'
    ];
    
    // Форматирование данных
    const rows = allReportsData.map(r => [
        r.id,
        r.timestamp ? new Date(r.timestamp.seconds * 1000).toISOString() : '',
        r.username || r.user_id,
        r.user_id,
        r.settlement,
        r.address,
        r.loyalty,
        r.action,
        // Оборачиваем комментарий в кавычки и экранируем внутренние кавычки
        String(r.comment).replace(/"/g, '""'), 
        r.latitude || '',
        r.longitude || ''
    ]);

    let csvContent = headers.map(h => `"${h}"`).join(';') + '\n';
    rows.forEach(row => {
        // Каждую ячейку оборачиваем в кавычки для безопасности
        csvContent += row.map(cell => `"${cell}"`).join(';') + '\n';
    });

    // BOM для корректного отображения кириллицы в Excel
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' }); 
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reports_export_${new Date().toISOString().slice(0, 10)}.csv`);
    
    // Имитация клика для скачивания
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    window.showAlert('Успех', 'Данные экспортированы в reports_export.csv');
}

// Заполнение списка НП для фильтров (вызывается в loadDashboard)
const settlementFilter = document.getElementById('settlementFilter');
if (settlementFilter) {
    // Вся логика заполнения перенесена в window.loadDashboard
}
