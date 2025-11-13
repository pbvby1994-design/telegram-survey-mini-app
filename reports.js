// reports.js (ИСПРАВЛЕННАЯ ВЕРСИЯ - СИНТАКСИС GLOBAL)

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

    // Безопасный доступ к DOM
    const ctx = document.getElementById('loyaltyChart')?.getContext('2d');
    if (!ctx) return;

    loyaltyChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Сильная поддержка', 'Умеренная поддержка', 'Нейтрально', 'Против'],
            datasets: [{
                data: Object.values(loyaltyCounts),
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                title: { display: false }
            }
        }
    });
}

function renderActionChart(reportList) {
    if (actionChartInstance) {
        actionChartInstance.destroy();
    }
    
    const actionCounts = {
        conversation: 0, handout: 0, visit: 0
    };
    
    reportList.forEach(r => {
        if (actionCounts.hasOwnProperty(r.action)) {
            actionCounts[r.action]++;
        }
    });

    // Безопасный доступ к DOM
    const ctx = document.getElementById('actionChart')?.getContext('2d');
    if (!ctx) return;

    actionChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Разговор', 'Вручение материала', 'Посещение'],
            datasets: [{
                label: 'Количество действий',
                data: Object.values(actionCounts),
                backgroundColor: ['#4f46e5', '#3730a3', '#1e3a8a'],
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
                legend: { display: false }
            }
        }
    });
}


// ----------------------------------------------------------------------------------
// ФУНКЦИИ КАРТЫ 
// ----------------------------------------------------------------------------------

window.renderMap = function(reportList) {
    const mapContainer = document.getElementById('mapContainer');
    const mapLoading = document.getElementById('mapLoading');

    // 1. Показываем загрузку, если есть
    if (mapLoading) {
        mapLoading.classList.remove('hidden');
    }

    // 2. Проверяем, что карта и API готовы
    if (!window.mapInstance || typeof ymaps === 'undefined') {
        if (mapLoading) mapLoading.classList.add('hidden');
        mapContainer.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-gray-500">Карта еще не инициализирована или API не загружен.</div>`;
        return;
    }
    
    // 3. Очищаем старые объекты
    window.mapInstance.geoObjects.removeAll();

    const clusterer = new ymaps.Clusterer({
        preset: 'islands#invertedVioletClusterIcons',
        groupByCoordinates: false,
        clusterDisableClickZoom: false,
        clusterHideIconOnZoom: true,
        geoObjectHideIconOnZoom: true,
        margin: [50, 50]
    });

    let hasGeoData = false;
    let bounds = null;

    reportList.forEach(r => {
        if (r.latitude && r.longitude) {
            hasGeoData = true;
            
            const loyaltyColor = r.loyalty === 'strong' ? 'green' : 
                                 r.loyalty === 'moderate' ? 'blue' : 
                                 r.loyalty === 'neutral' ? 'yellow' : 'red';
            
            const placemark = new ymaps.Placemark([r.latitude, r.longitude], {
                balloonContentHeader: `${r.settlement}`,
                balloonContentBody: `
                    <strong>Адрес:</strong> ${r.address}<br>
                    <strong>Лояльность:</strong> ${r.loyalty}<br>
                    <strong>Действие:</strong> ${r.action}<br>
                    <strong>Агитатор:</strong> ${r.username || 'N/A'}<br>
                    <strong>Дата:</strong> ${r.timestamp.toLocaleDateString()}
                `,
                hintContent: `${r.address} (${r.loyalty})`
            }, {
                preset: `islands#${loyaltyColor}DotIcon`
            });

            clusterer.add(placemark);

            // Обновление границ карты
            if (bounds) {
                bounds = ymaps.util.bounds.include(bounds, [r.latitude, r.longitude]);
            } else {
                bounds = ymaps.util.bounds.fromPoints([[r.latitude, r.longitude]]);
            }
        }
    });

    if (hasGeoData) {
        window.mapInstance.geoObjects.add(clusterer);
        // Центрируем карту по сгруппированным объектам
        if (bounds) {
            // mapInstance.setBounds принимает [bottomLeft, topRight]
            window.mapInstance.setBounds(bounds, { checkZoom: true, zoomMargin: 50 });
        }
        // Убедимся, что карта обновила свой размер в контейнере Telegram WebApp
        window.mapInstance.container.fitToViewport();
    } else {
         mapContainer.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-gray-500">Нет данных с геолокацией для отображения на карте.</div>`;
    }

    if (mapLoading) {
        mapLoading.classList.add('hidden');
    }
}


// ----------------------------------------------------------------------------------
// ФУНКЦИИ ЗАГРУЗКИ И ОБРАБОТКИ ОТЧЕТОВ
// ----------------------------------------------------------------------------------

// Центральная функция для получения отчетов
window.fetchReports = function(settlementFilter = null) {
    if (!window.db) {
         console.error("Firestore не инициализирован для fetchReports.");
         document.getElementById('mapLoading')?.classList.add('hidden');
         return;
    }

    let reportsRef = window.db.collection('reports');
    let q;

    try {
        // Отменяем предыдущую подписку, если она была (для избежания дублирования)
        if (window.activeReportsQuery) {
             window.activeReportsQuery();
        }

        let queryChain = reportsRef;
        
        if (window.isAdmin) {
             // Администратор: фильтр по НП (если выбран)
             if (settlementFilter) {
                 queryChain = queryChain.where('settlement', '==', settlementFilter);
             }
             queryChain = queryChain.orderBy('timestamp', 'desc').limit(1000);
        } else {
             // Агитатор: фильтр по user_id
             if (window.userTelegramId) {
                 queryChain = queryChain.where('user_id', '==', window.userTelegramId);
             }
             queryChain = queryChain.orderBy('timestamp', 'desc').limit(50); 
        }

        // Используем onSnapshot для живого обновления данных
        window.activeReportsQuery = queryChain.onSnapshot((querySnapshot) => {
            window.latestReportData = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                window.latestReportData.push({ 
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp ? data.timestamp.toDate() : new Date() 
                });
            });

            // Обновляем все UI-компоненты
            if (window.isAdmin) {
                 window.renderAdminUI();
            } else {
                 window.renderAgitatorReports(window.latestReportData);
            }
        }, (error) => {
            console.error("Error listening to reports:", error);
            window.showAlert('Ошибка загрузки', `Не удалось загрузить отчеты: ${error.message}`);
        });

    } catch (error) {
        console.error("Error setting up reports query:", error);
        window.showAlert('Ошибка', `Не удалось настроить запрос: ${error.message}`);
    }
}

// Рендер UI для Администратора (Карта, Статистика)
window.renderAdminUI = function() {
    const currentSection = document.querySelector('.content-section:not(.hidden)')?.id;
    
    // 1. Рендер Графиков
    if (currentSection === 'stats' || currentSection === 'raw-data') {
         renderLoyaltyChart(window.latestReportData);
         renderActionChart(window.latestReportData);
    }
    
    // 2. Рендер Карты
    if (currentSection === 'map-view' && typeof ymaps !== 'undefined') {
        window.renderMap(window.latestReportData);
    }
    
    // 3. Обновление статуса
    const reportStatus = document.getElementById('reportStatus');
    if (reportStatus) {
        reportStatus.textContent = `Загружено отчетов: ${window.latestReportData.length} (Обновляется в реальном времени)`;
        document.getElementById('exportCsvButton').disabled = window.latestReportData.length === 0;
    }
}

// ... Остальные функции (renderAgitatorReports, editReport, exportToCsv) остаются без изменений
// ... (для краткости не повторяем их, но они должны быть в reports.js)
window.renderAgitatorReports = function(reports) {
    const listContainer = document.getElementById('agitatorReportsList');
    if (!listContainer) return;

    listContainer.innerHTML = ''; // Очистка
    
    if (reports.length === 0) {
         listContainer.innerHTML = `<p class="text-center text-gray-500 p-4">У вас пока нет сохраненных отчетов.</p>`;
         return;
    }

    const now = new Date();

    reports.forEach(report => {
        const reportTime = report.timestamp instanceof Date ? report.timestamp : new Date();
        const isEditable = (now.getTime() - reportTime.getTime()) < (30 * 60 * 1000); 

        const loyaltyMap = {
            strong: 'Сильная поддержка', moderate: 'Умеренная поддержка', neutral: 'Нейтрально', against: 'Против'
        };
        const actionMap = {
            conversation: 'Разговор', handout: 'Вручение материала', visit: 'Посещение'
        };

        const loyaltyColor = report.loyalty === 'strong' ? 'bg-green-100 text-green-800' :
                             report.loyalty === 'moderate' ? 'bg-blue-100 text-blue-800' :
                             report.loyalty === 'neutral' ? 'bg-yellow-100 text-yellow-800' :
                             'bg-red-100 text-red-800';

        const item = document.createElement('div');
        item.className = 'p-4 border border-gray-200 rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow';
        item.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h4 class="text-lg font-semibold text-gray-900">${report.settlement} - ${report.address}</h4>
                <span class="text-sm font-medium ${loyaltyColor} px-3 py-1 rounded-full">${loyaltyMap[report.loyalty] || report.loyalty}</span>
            </div>
            <p class="text-sm text-gray-600 mb-1">Действие: <strong>${actionMap[report.action] || report.action}</strong></p>
            <p class="text-xs text-gray-500 mb-2">
                ${reportTime.toLocaleDateString()} ${reportTime.toLocaleTimeString()} 
                ${report.comment ? ' | Комментарий: ' + report.comment.substring(0, 50) + (report.comment.length > 50 ? '...' : '') : ''}
            </p>
            <div class="mt-3 text-right">
                ${isEditable 
                    ? `<button onclick="window.editReport('${report.id}')" class="text-sm bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md transition duration-150">
                           <span data-lucide="edit-3" class="w-4 h-4 inline mr-1"></span> Редактировать
                       </button>`
                    : `<span class="text-sm text-gray-400">Редактирование блокировано</span>`
                }
            </div>
        `;
        listContainer.appendChild(item);
    });
    
    if (typeof lucide !== 'undefined') {
         lucide.createIcons();
    }
}

window.editReport = function(docId) {
    const report = window.latestReportData.find(r => r.id === docId);
    if (!report) {
        window.showAlert('Ошибка', 'Отчет для редактирования не найден.');
        return;
    }

    document.getElementById('settlement').value = report.settlement;
    document.getElementById('address').value = report.address;
    document.querySelector(`input[name="loyalty"][value="${report.loyalty}"]`).checked = true;
    document.querySelector(`input[name="action"][value="${report.action}"]`).checked = true;
    document.getElementById('comment').value = report.comment;
    
    window.currentLatitude = report.latitude;
    window.currentLongitude = report.longitude;
    document.getElementById('geoStatus').textContent = report.latitude && report.longitude 
        ? `✅ GPS (из отчета): ${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}` 
        : 'Геолокация: ❓ Не получена';
        
    window.selectedSuggestionData = { geo_lat: report.latitude, geo_lon: report.longitude }; // Имитация выбора Dadata
        
    document.getElementById('reportForm').onsubmit = function(event) {
        event.preventDefault();
        window.saveReport(docId); 
    };

    document.getElementById('saveButton').innerHTML = '<span data-lucide="save" class="w-5 h-5 mr-2"></span> Обновить Отчет (Редактирование)';
    document.getElementById('saveButton').classList.remove('bg-indigo-600');
    document.getElementById('saveButton').classList.add('bg-yellow-600');
    
    window.showSection('form-view');
    if (typeof lucide !== 'undefined') {
         lucide.createIcons();
    }
}

window.exportToCsv = function() {
    if (window.latestReportData.length === 0) {
        window.showAlert('Ошибка', 'Нет данных для экспорта.');
        return;
    }

    const headers = [
        'ID', 'Дата', 'Агитатор', 'Telegram ID', 'НП', 'Адрес', 'Лояльность', 'Действие', 'Комментарий', 'Широта', 'Долгота'
    ];

    const rows = window.latestReportData.map(r => [
        r.id,
        r.timestamp.toISOString(),
        r.username,
        r.user_id,
        r.settlement,
        r.address,
        r.loyalty,
        r.action,
        r.comment.replace(/"/g, '""'), 
        r.latitude || '',
        r.longitude || ''
    ]);

    let csvContent = headers.join(';') + '\n';
    rows.forEach(row => {
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

const settlementFilter = document.getElementById('settlementFilter');
if (settlementFilter) {
    // Заполняем список НП
    window.SETTLEMENTS.forEach(settlement => {
        const option = document.createElement('option');
        option.value = settlement;
        option.textContent = settlement;
        settlementFilter.appendChild(option);
    });
    
    settlementFilter.addEventListener('change', () => {
        if (window.isAdmin && typeof window.fetchReports === 'function') {
            window.fetchReports(settlementFilter.value || null);
        }
    });
}
