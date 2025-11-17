// reports.js (ОБНОВЛЕННАЯ ВЕРСИЯ С ЗАГЛУШКАМИ ДЛЯ ГРАФИКОВ)

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let loyaltyChartInstance = null; 
let actionChartInstance = null; 
let allReportsData = []; 
// Использование window для доступа из других файлов
window.SETTLEMENTS = [ 
    'г.п. Лянтор', 'с.п. Русскинская', 'г.п. Федоровский', 'г.п. Барсово', 
    'г.п. Белый Яр', 'с.п. Лямина', 'с.п. Сытомино', 'с.п. Угут', 
    'с.п. Ульт-Ягун', 'с.п. Солнечный', 'с.п. Нижнесортымский', 
    'с.п. Тундрино', 'с.п. Локосово'
];
window.latestReportData = []; 
window.activeReportsQuery = null; 

// ----------------------------------------------------------------------------------
// ФУНКЦИИ ГРАФИКОВ (С ЗАГЛУШКАМИ)
// ----------------------------------------------------------------------------------

/**
 * Рендерит график распределения лояльности.
 * @param {Array<Object>} reportList Список отчетов.
 */
function renderLoyaltyChart(reportList) {
    const noDataBlock = document.getElementById('loyaltyNoData');
    
    if (reportList.length === 0) {
        if (loyaltyChartInstance) {
            loyaltyChartInstance.destroy();
            loyaltyChartInstance = null;
        }
        noDataBlock?.classList.remove('hidden');
        return;
    }
    
    noDataBlock?.classList.add('hidden'); // Скрываем заглушку
    
    if (loyaltyChartInstance) {
        loyaltyChartInstance.destroy();
    }
    
    const loyaltyCounts = {
        strong: 0, moderate: 0, neutral: 0, against: 0
    };
    
    reportList.forEach(r => {
        if (r.loyalty in loyaltyCounts) {
            loyaltyCounts[r.loyalty]++;
        }
    });

    const ctx = document.getElementById('loyaltyChart').getContext('2d');
    loyaltyChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['1. Ярко выраженная', '2. Умеренная', '3. Нейтральная', '4. Против'],
            datasets: [{
                data: [loyaltyCounts.strong, loyaltyCounts.moderate, loyaltyCounts.neutral, loyaltyCounts.against],
                backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: false
                }
            }
        }
    });
}

/**
 * Рендерит график проведенных действий.
 * @param {Array<Object>} reportList Список отчетов.
 */
function renderActionChart(reportList) {
    const noDataBlock = document.getElementById('actionNoData');

    if (reportList.length === 0) {
        if (actionChartInstance) {
            actionChartInstance.destroy();
            actionChartInstance = null;
        }
        noDataBlock?.classList.remove('hidden');
        return;
    }
    
    noDataBlock?.classList.add('hidden'); // Скрываем заглушку

    if (actionChartInstance) {
        actionChartInstance.destroy();
    }

    const actionCounts = {};

    reportList.forEach(r => {
        const actionKey = r.action || 'unknown'; // Обработка случая, если action не определен
        actionCounts[actionKey] = (actionCounts[actionKey] || 0) + 1;
    });
    
    const labelsMap = {
        'call': 'Телефонный звонок',
        'face-to-face': 'Обход/Личная встреча',
        'mail': 'Раздача материалов',
        'other': 'Другое',
        'unknown': 'Не указано'
    };
    
    const labels = Object.keys(actionCounts).map(key => labelsMap[key] || key);
    const data = Object.values(actionCounts);
    
    const ctx = document.getElementById('actionChart').getContext('2d');
    actionChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Количество действий',
                data: data,
                backgroundColor: ['#4f46e5', '#3b82f6', '#10b981', '#f59e0b', '#6b7280'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false
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
 * Глобальная функция для рендеринга всех графиков.
 * Вызывается при переключении на вкладку статистики или при изменении фильтра.
 * @param {Array<Object>} data Список отчетов.
 */
window.renderAllCharts = function(data) {
    renderLoyaltyChart(data);
    renderActionChart(data);
};

// ----------------------------------------------------------------------------------
// ЗАГРУЗКА, ФИЛЬТРАЦИЯ И ОТОБРАЖЕНИЕ ОТЧЕТОВ
// ----------------------------------------------------------------------------------

/**
 * Форматирует отчет для отображения в списке "Мои отчеты".
 * @param {Object} report Отчет из Firestore.
 * @param {string} reportId ID документа.
 * @returns {string} HTML-строка.
 */
function formatMyReport(report, reportId) {
    const loyaltyColors = {
        strong: 'bg-green-100 text-green-800',
        moderate: 'bg-yellow-100 text-yellow-800',
        neutral: 'bg-blue-100 text-blue-800',
        against: 'bg-red-100 text-red-800',
    };
    const loyaltyLabels = {
        strong: 'Ярко выраженная',
        moderate: 'Умеренная',
        neutral: 'Нейтральная',
        against: 'Против',
    };

    const formattedDate = report.timestamp ? (report.timestamp.toDate ? report.timestamp.toDate().toLocaleString('ru-RU') : new Date(report.timestamp).toLocaleString('ru-RU')) : 'Дата неизвестна';
    const loyaltyClass = loyaltyColors[report.loyalty] || 'bg-gray-100 text-gray-800';
    const loyaltyText = loyaltyLabels[report.loyalty] || report.loyalty;

    return `
        <div class="p-3 border rounded-lg bg-gray-50 hover:shadow-md transition duration-200">
            <div class="flex justify-between items-start mb-2">
                <span class="text-xs font-semibold ${loyaltyClass} px-2.5 py-0.5 rounded-full">${loyaltyText}</span>
                <span class="text-xs text-gray-500">${formattedDate}</span>
            </div>
            <p class="font-bold text-gray-800">${report.settlement}, ${report.address}</p>
            <p class="text-sm text-gray-600 mt-1">Действие: ${report.action || 'Не указано'}</p>
            ${report.comment ? `<p class="text-xs text-gray-500 mt-1 italic">Комментарий: ${report.comment}</p>` : ''}
            <p class="text-xs text-gray-400 mt-1">ID: ${reportId}</p>
        </div>
    `;
}

/**
 * Обновляет список "Мои отчеты".
 * Вызывается из main.js после успешной отправки.
 */
window.updateMyReportsView = function() {
    // Используем уже загруженные данные, отфильтровав только отчеты текущего пользователя
    if (window.userTelegramId && allReportsData.length > 0) {
        const myReports = allReportsData
            .filter(r => String(r.user_id) === String(window.userTelegramId))
            .sort((a, b) => b.timestamp - a.timestamp); // Сортировка по убыванию даты
            
        const container = document.getElementById('myReportsList');
        if (container) {
            if (myReports.length === 0) {
                container.innerHTML = '<p class="text-gray-500 p-4 border rounded-lg bg-yellow-50">Вы пока не отправили ни одного отчета.</p>';
            } else {
                container.innerHTML = myReports.map(r => formatMyReport(r, r.id)).join('');
            }
        }
    } else if (document.getElementById('myReportsList')) {
         document.getElementById('myReportsList').innerHTML = '<p class="text-gray-500">Загрузка ваших отчетов...</p>';
    }
}


/**
 * Загружает все отчеты из Firestore.
 * @param {'all' | 'my'} mode Режим загрузки: все (для админа) или только свои (для агитатора).
 */
window.loadReports = async function(mode) {
    if (!window.db) {
        console.error("Firestore DB not initialized.");
        return;
    }

    try {
        let query = window.db.collection('reports').orderBy('timestamp', 'desc');
        
        // В режиме "Мои отчеты" добавляем фильтр по ID пользователя
        if (mode === 'my' && window.userTelegramId) {
            query = query.where('user_id', '==', window.userTelegramId);
        }

        const snapshot = await query.get();
        allReportsData = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            allReportsData.push({
                id: doc.id,
                ...data,
                // Обеспечиваем, что timestamp всегда объект Date для сортировки/отображения
                timestamp: data.timestamp && data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp),
            });
        });
        
        window.latestReportData = [...allReportsData]; // Копия данных для фильтрации

        // 1. Обновляем "Мои Отчеты" (если это агитатор)
        if (mode === 'my') {
            window.updateMyReportsView();
        }
        
        // 2. Обновляем статистику и карту (если это админ)
        if (window.isAdmin) {
             window.renderAllCharts(window.latestReportData);
             window.loadRawDataTable(window.latestReportData);

             // Загружаем данные на карту, если она инициализирована
             if (window.mapInstance) {
                window.loadMapData(); 
             }
        }

    } catch (error) {
        console.error("Error loading reports:", error);
        window.showAlert('Ошибка Загрузки', `Не удалось загрузить отчеты: ${error.message}.`);
    }
}


// ----------------------------------------------------------------------------------
// ФИЛЬТРЫ И КАРТА
// ----------------------------------------------------------------------------------

/**
 * Фильтрует данные отчетов для графиков.
 * @param {string} settlement Название населенного пункта или 'all'.
 */
window.filterStatsData = function(settlement) {
    let filteredData = allReportsData;
    if (settlement !== 'all') {
        filteredData = allReportsData.filter(r => r.settlement === settlement);
    }
    window.latestReportData = filteredData;
    window.renderAllCharts(filteredData);
    window.loadRawDataTable(filteredData);
}

/**
 * Фильтрует данные для карты.
 * @param {string} settlement Название населенного пункта или 'all'.
 */
window.filterMapData = function(settlement) {
    if (!window.mapInstance) return;

    // Очищаем карту
    window.mapInstance.geoObjects.removeAll();

    let filteredData = allReportsData;
    if (settlement !== 'all') {
        filteredData = allReportsData.filter(r => r.settlement === settlement);
    }

    // Создаем коллекцию для меток
    const placemarkCollection = new ymaps.GeoObjectCollection(null, {
        preset: 'islands#violetDotIconWithCaption', // Стандартная метка
        // clusterize: true // Можно включить кластеризацию
    });

    filteredData.forEach(report => {
        if (report.latitude && report.longitude) {
            const loyaltyLabels = {
                strong: 'Ярко выраженная', moderate: 'Умеренная', neutral: 'Нейтральная', against: 'Против',
            };
            const loyaltyColors = {
                strong: 'islands#greenDotIcon', moderate: 'islands#yellowDotIcon', 
                neutral: 'islands#blueDotIcon', against: 'islands#redDotIcon',
            };
            
            const contentBody = `
                <div style="font-family: 'Jost', sans-serif; max-width: 250px;">
                    <h4 style="font-weight: 700; margin-bottom: 5px;">${report.settlement}, ${report.address}</h4>
                    <p style="margin-bottom: 3px;">Лояльность: <strong>${loyaltyLabels[report.loyalty] || report.loyalty}</strong></p>
                    <p style="margin-bottom: 3px;">Действие: ${report.action || '—'}</p>
                    ${report.comment ? `<p style="font-size: 0.9em; color: #555;">${report.comment.substring(0, 100)}...</p>` : ''}
                    <p style="font-size: 0.8em; color: #999; margin-top: 5px;">Агитатор: ${report.username}</p>
                </div>
            `;

            placemarkCollection.add(new ymaps.Placemark([report.latitude, report.longitude], {
                balloonContentHeader: `${report.settlement}, ${report.address}`,
                balloonContentBody: contentBody,
                hintContent: `${report.settlement}: ${loyaltyLabels[report.loyalty] || report.loyalty}`
            }, {
                preset: loyaltyColors[report.loyalty] || 'islands#grayDotIcon'
            }));
        }
    });
    
    window.mapInstance.geoObjects.add(placemarkCollection);

    // Центрирование карты по меткам, если они есть
    if (placemarkCollection.getLength() > 0) {
        window.mapInstance.setBounds(placemarkCollection.getBounds(), {
            checkZoomRange: true,
            // Добавляем отступ, чтобы метки не прилипали к краям
            zoomMargin: 30 
        });
    } else {
        // Если меток нет, сброс к центру ХМАО
        window.mapInstance.setCenter([61.25, 73.4], 7);
    }
}


/**
 * Загружает данные на карту (первичная загрузка)
 */
window.loadMapData = function() {
    if (window.mapInstance && allReportsData.length > 0) {
        // Вызываем фильтр для загрузки всех данных
        filterMapData('all'); 
    }
}

// ----------------------------------------------------------------------------------
// ТАБЛИЦА СЫРЫХ ДАННЫХ
// ----------------------------------------------------------------------------------

/**
 * Загружает данные отчетов в таблицу.
 * @param {Array<Object>} reportList Отфильтрованный список отчетов.
 */
window.loadRawDataTable = function(reportList) {
    const tableBody = document.getElementById('reportsTableBody');
    if (!tableBody) return;

    if (reportList.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="px-3 py-4 whitespace-nowrap text-sm text-gray-500">Нет данных для отображения.</td></tr>';
        return;
    }

    const rows = reportList.map(r => {
        const formattedDate = r.timestamp ? r.timestamp.toLocaleString('ru-RU') : '—';
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-500">${r.id.substring(0, 5)}...</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${formattedDate}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${r.username || r.user_id}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${r.settlement}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${r.address}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${r.loyalty}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${r.action}</td>
                <td class="px-3 py-2 text-sm text-gray-900 truncate max-w-xs">${r.comment || '—'}</td>
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = rows;
}

// ----------------------------------------------------------------------------------
// CSV ЭКСПОРТ
// ----------------------------------------------------------------------------------

/**
 * Экспортирует текущие отфильтрованные данные в CSV.
 */
window.exportReportsToCsv = function() {
    if (window.latestReportData.length === 0) {
        window.showAlert('Ошибка экспорта', 'Нет данных для экспорта.');
        return;
    }

    const headers = ['ID', 'Время', 'Пользователь (ник)', 'ID пользователя', 'Населенный пункт', 'Адрес', 'Лояльность', 'Действие', 'Комментарий', 'Широта', 'Долгота'];
    
    // Подготовка строк
    const rows = window.latestReportData.map(r => [
        r.id,
        // Преобразуем timestamp в ISO строку
        r.timestamp instanceof Date ? r.timestamp.toISOString() : (r.timestamp && r.timestamp.toDate ? r.timestamp.toDate().toISOString() : r.timestamp),
        r.username,
        r.user_id,
        r.settlement,
        r.address,
        r.loyalty,
        r.action,
        // Экранирование двойными кавычками для комментариев
        String(r.comment || '').replace(/"/g, '""'), 
        r.latitude || '',
        r.longitude || ''
    ]);

    let csvContent = headers.map(h => `"${h}"`).join(';') + '\n';
    rows.forEach(row => {
        // Экранируем каждую ячейку двойными кавычками
        csvContent += row.map(cell => `"${cell}"`).join(';') + '\n';
    });

    // Добавляем BOM для корректного отображения кириллицы в Excel
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' }); 
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reports_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    window.showAlert('Экспорт', 'Данные успешно экспортированы в CSV.');
}


// Заполняем фильтр карты при загрузке (если он есть)
const settlementFilter = document.getElementById('settlementFilter');
if (settlementFilter) {
    window.SETTLEMENTS.forEach(settlement => {
        const option = document.createElement('option');
        option.value = settlement;
        option.textContent = settlement;
        settlementFilter.appendChild(option);
    });
}
