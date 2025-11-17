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

// ----------------------------------------------------------------------------------
// ФУНКЦИИ ГРАФИКОВ 
// ----------------------------------------------------------------------------------

function renderLoyaltyChart(reportList) {
    const chartElementId = 'loyaltyChart';
    const noDataElementId = 'noLoyaltyDataMessage';

    if (loyaltyChartInstance) {
        loyaltyChartInstance.destroy();
    }
    
    const loyaltyCounts = {
        strong: 0, moderate: 0, neutral: 0, against: 0
    };
    
    reportList.forEach(r => {
        if (r.loyalty && loyaltyCounts.hasOwnProperty(r.loyalty)) {
            loyaltyCounts[r.loyalty]++;
        }
    });

    const labels = [
        'Яркая поддержка', 
        'Умеренная поддержка', 
        'Нейтралитет', 
        'Против'
    ];
    const data = [
        loyaltyCounts.strong, 
        loyaltyCounts.moderate, 
        loyaltyCounts.neutral, 
        loyaltyCounts.against
    ];
    
    const totalCount = data.reduce((sum, count) => sum + count, 0);
    
    // ИСПРАВЛЕНИЕ: Проверка на пустые данные и управление видимостью
    if (totalCount === 0) {
        updateChartVisibility(chartElementId, noDataElementId, false);
        return;
    }
    updateChartVisibility(chartElementId, noDataElementId, true);

    const ctx = document.getElementById(chartElementId).getContext('2d');
    
    loyaltyChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Лояльность',
                data: data,
                backgroundColor: [
                    'rgba(76, 175, 80, 0.8)', // Green (strong)
                    'rgba(139, 195, 74, 0.8)', // Light Green (moderate)
                    'rgba(255, 193, 7, 0.8)', // Amber (neutral)
                    'rgba(244, 67, 54, 0.8)' // Red (against)
                ],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Распределение лояльности'
                }
            }
        }
    });
}

function renderActionChart(reportList) {
    const chartElementId = 'actionChart';
    const noDataElementId = 'noActionDataMessage';

    if (actionChartInstance) {
        actionChartInstance.destroy();
    }
    
    const actionCounts = {};
    
    reportList.forEach(r => {
        const action = (r.action || 'Нет действия').trim() || 'Нет действия';
        if (actionCounts[action]) {
            actionCounts[action]++;
        } else {
            actionCounts[action] = 1;
        }
    });
    
    // Сортировка по количеству
    const sortedActions = Object.entries(actionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10); // Топ 10
        
    const labels = sortedActions.map(([action]) => action);
    const data = sortedActions.map(([, count]) => count);

    const totalCount = data.reduce((sum, count) => sum + count, 0);
    
    // ИСПРАВЛЕНИЕ: Проверка на пустые данные и управление видимостью
    if (totalCount === 0) {
        updateChartVisibility(chartElementId, noDataElementId, false);
        return;
    }
    updateChartVisibility(chartElementId, noDataElementId, true);

    // Случайные цвета для действий
    const backgroundColors = data.map(() => `hsl(${Math.random() * 360}, 70%, 50%)`);

    const ctx = document.getElementById(chartElementId).getContext('2d');
    
    actionChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Количество',
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Топ-10 проведенных действий'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

/**
 * Глобальная функция для принудительного обновления графиков. 
 * Вызывается при переключении на вкладку 'stats'.
 */
window.updateStatsCharts = function() {
    if (window.latestReportData) {
        const filterValue = document.getElementById('settlementStatsFilter')?.value || 'all';
        let dataToRender = window.latestReportData;
        
        if (filterValue !== 'all') {
            dataToRender = window.latestReportData.filter(r => r.settlement === filterValue);
        }

        renderLoyaltyChart(dataToRender);
        renderActionChart(dataToRender);
    } else {
         // Отображаем сообщение об отсутствии данных, если данных еще нет
         renderLoyaltyChart([]);
         renderActionChart([]);
    }
}


// ----------------------------------------------------------------------------------
// ФУНКЦИИ ЗАГРУЗКИ ДАННЫХ И ТАБЛИЦЫ
// ----------------------------------------------------------------------------------

/**
 * Загружает отчеты из Firebase.
 * @param {'all'|'my'} type Тип загружаемых отчетов.
 */
window.loadReports = async function(type = 'my') {
    if (!window.db) {
        console.error("Firebase DB не инициализирован для загрузки отчетов.");
        window.latestReportData = [];
        window.updateStatsCharts();
        return;
    }

    try {
        let query = window.db.collection('reports').orderBy('timestamp', 'desc');
        
        // Фильтрация по пользователю для агитаторов
        if (type === 'my' && !window.isAdmin) {
            query = query.where('user_id', '==', window.userTelegramId);
        }
        
        // Фильтрация по населенному пункту для статистики (если установлен фильтр)
        const filterElement = document.getElementById('settlementStatsFilter');
        if (window.isAdmin && filterElement && filterElement.value !== 'all') {
            query = query.where('settlement', '==', filterElement.value);
        }
        
        const snapshot = await query.get();
        window.latestReportData = snapshot.docs.map(doc => ({
            id: doc.id,
            timestamp: doc.data().timestamp ? doc.data().timestamp.toDate() : new Date(),
            ...doc.data()
        }));

        // Обновление UI
        window.updateMyReportsView();
        window.updateRawDataTable();
        // Графики будут обновлены при переключении на вкладку 'stats' через window.showSection
        
    } catch (error) {
        console.error("Ошибка загрузки отчетов из Firebase:", error);
        window.showAlert('Ошибка данных', `Не удалось загрузить отчеты: ${error.message}`);
        window.latestReportData = [];
        window.updateStatsCharts();
    }
}

/**
 * Обновляет список отчетов для вкладки "Мои Отчеты"
 */
window.updateMyReportsView = function() {
    const container = document.getElementById('my-reports-view');
    const myReportsList = document.getElementById('my-reports-list');
    if (!container || !myReportsList) return;

    // Фильтруем только отчеты текущего пользователя, если это не админ
    const reportsToDisplay = window.isAdmin 
        ? window.latestReportData 
        : window.latestReportData.filter(r => r.user_id === window.userTelegramId);
        
    if (reportsToDisplay.length === 0) {
        myReportsList.innerHTML = '<p class="text-gray-500 p-4">У вас пока нет сохраненных отчетов.</p>';
        return;
    }

    myReportsList.innerHTML = reportsToDisplay.map(r => `
        <div class="bg-gray-100 p-3 rounded-lg border-l-4 ${r.loyalty === 'strong' ? 'border-green-500' : r.loyalty === 'against' ? 'border-red-500' : 'border-indigo-500'} shadow-sm">
            <div class="font-semibold text-gray-800">${r.settlement} / ${r.address || '—'}</div>
            <div class="text-sm text-gray-600 mt-1">
                <span class="font-medium">Лояльность:</span> ${r.loyalty} | 
                <span class="font-medium">Действие:</span> ${r.action || '—'}
            </div>
            <div class="text-xs text-gray-500 mt-1">
                ${r.comment ? 'Комментарий: ' + r.comment : 'Нет комментария'}
            </div>
            <div class="text-xs text-gray-400 mt-1">${r.timestamp.toLocaleString('ru-RU')}</div>
        </div>
    `).join('');
}


/**
 * Обновляет таблицу сырых данных
 */
window.updateRawDataTable = function() {
    const tbody = document.getElementById('rawReportsTableBody');
    if (!tbody || !window.isAdmin) return;
    
    // Используем все загруженные данные (они уже отфильтрованы по НП, если это нужно)
    const dataToDisplay = window.latestReportData; 
    
    if (dataToDisplay.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-gray-500">Нет данных для отображения.</td></tr>';
        return;
    }
    
    tbody.innerHTML = dataToDisplay.map(r => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${r.id.slice(0, 6)}...</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${r.timestamp.toLocaleString('ru-RU')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${r.username || r.user_id}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${r.settlement}</td>
            <td class="px-6 py-4 whitespace-normal text-sm text-gray-700">${r.address || '—'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${r.loyalty === 'strong' ? 'text-green-600' : r.loyalty === 'against' ? 'text-red-600' : 'text-gray-500'}">${r.loyalty}</td>
            <td class="px-6 py-4 whitespace-normal text-sm text-gray-700">${r.action || '—'}</td>
            <td class="px-6 py-4 whitespace-normal text-sm text-gray-700">${r.comment || '—'}</td>
        </tr>
    `).join('');
}

/**
 * Экспортирует текущие данные в CSV.
 */
window.exportReportsToCSV = function() {
    if (!window.latestReportData || window.latestReportData.length === 0) {
        window.showAlert('Ошибка', 'Нет данных для экспорта.');
        return;
    }

    const headers = [
        'ID', 'Дата', 'Username', 'User_ID', 'Населенный_пункт', 
        'Адрес', 'Лояльность', 'Действие', 'Комментарий', 'Широта', 'Долгота'
    ];
    
    const rows = window.latestReportData.map(r => [\
        r.id,
        r.timestamp.toISOString(),
        r.username,
        r.user_id,
        r.settlement,
        r.address,
        r.loyalty,
        r.action,
        r.comment ? r.comment.replace(/\"/g, '\"\"') : '', // Экранирование кавычек
        r.latitude || '',
        r.longitude || ''
    ]);

    let csvContent = headers.join(';') + '\n';
    rows.forEach(row => {
        // Обертывание всех ячеек в кавычки для корректного отображения CSV
        csvContent += row.map(cell => `"${cell}"`).join(';') + '\n';
    });

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' }); 
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reports_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ----------------------------------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ И ОБРАБОТКА ФИЛЬТРОВ
// ----------------------------------------------------------------------------------

const settlementFilter = document.getElementById('settlementStatsFilter');
if (settlementFilter) {
    settlementFilter.addEventListener('change', () => {
        // Перезагрузка данных с учетом нового фильтра
        window.loadReports(window.isAdmin ? 'all' : 'my'); 
        // Принудительное обновление графиков
        window.updateStatsCharts(); 
    });
}

// ----------------------------------------------------------------------------------
// ФУНКЦИИ КАРТЫ (ДЛЯ АДМИНА)
// ----------------------------------------------------------------------------------

/**
 * Загружает данные на карту (вызывается после инициализации ymaps)
 */
window.loadMapData = function() {
    if (!window.mapInstance) return;

    // Очистка старых меток
    window.mapInstance.geoObjects.removeAll();

    const placemarks = window.latestReportData
        .filter(r => r.latitude && r.longitude) // Только отчеты с координатами
        .map(r => {
            const loyaltyColor = 
                r.loyalty === 'strong' ? 'green' :
                r.loyalty === 'moderate' ? 'light-green' :
                r.loyalty === 'against' ? 'red' :
                'yellow'; // neutral

            const loyaltyText = {
                strong: 'Яркая поддержка',
                moderate: 'Умеренная поддержка',
                neutral: 'Нейтралитет',
                against: 'Против'
            }[r.loyalty] || r.loyalty;

            const content = `
                <div class="p-2">
                    <h4 class="font-bold mb-1">${r.address || r.settlement}</h4>
                    <p class="text-sm">Лояльность: <span class="font-semibold">${loyaltyText}</span></p>
                    <p class="text-sm">Действие: ${r.action || '—'}</p>
                    <p class="text-xs text-gray-500 mt-1">${r.timestamp.toLocaleString('ru-RU')}</p>
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
            zoomMargin: 30
        });
    } else {
        console.log("Нет данных с координатами для отображения на карте.");
    }
}
