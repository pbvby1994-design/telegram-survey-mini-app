// reports.js (АДАПТИРОВАНО ПОД YANDEX MAPS С РОЛЕВОЙ МОДЕЛЬЮ)

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let loyaltyChartInstance = null; 
let actionChartInstance = null; 
window.latestReportData = []; 
window.mapInstance = null;
window.clusterer = null;

const SETTLEMENTS = [ 
    'г.п. Лянтор', 'с.п. Русскинская', 'г.п. Федоровский', 'г.п. Барсово', 
    'г.п. Белый Яр', 'с.п. Лямина', 'с.п. Сытомино', 'с.п. Угут', 
    'с.п. Ульт-Ягун', 'с.п. Солнечный', 'с.п. Нижнесортымский', 
    'с.п. Тундрино', 'с.п. Локосово'
];

// ... (renderLoyaltyChart, renderActionChart - остаются прежними) ...

// ----------------------------------------------------------------------------------
// 1. ФУНКЦИЯ ЗАГРУЗКИ ДАННЫХ (с фильтрацией по роли)
// ----------------------------------------------------------------------------------

window.fetchReports = async function(settlementFilter = null) {
    if (!window.db) {
         document.getElementById('reportStatus').textContent = '❌ Соединение с БД не установлено.';
         document.getElementById('mapLoading')?.classList.add('hidden'); 
         return;
    }
    
    const mapLoading = document.getElementById('mapLoading');
    if (mapLoading) mapLoading.classList.remove('hidden'); 

    document.getElementById('reportStatus').textContent = '⏳ Загрузка данных...';
    document.getElementById('exportCsvButton').disabled = true;

    try {
        let q = firebase.firestore().collection('reports');
        
        // --- ЛОГИКА ФИЛЬТРАЦИИ ПО РОЛИ ---
        if (!window.isAdmin) {
            // Агитатор: видим только свои отчеты
            if (!window.userTelegramId) throw new Error("Не удалось получить Telegram ID для фильтрации.");
            q = q.where('telegramId', '==', window.userTelegramId);
        } else {
            // Админ: используем фильтр по НП
            if (settlementFilter) {
                q = q.where('settlement', '==', settlementFilter);
            }
        }
        // ---------------------------------
        
        q = q.orderBy('timestamp', 'desc');

        const querySnapshot = await q.get();
        window.latestReportData = [];
        
        querySnapshot.forEach(doc => {
            window.latestReportData.push({ id: doc.id, ...doc.data() });
        });

        document.getElementById('reportStatus').textContent = `✅ Загружено записей: ${window.latestReportData.length}`;
        document.getElementById('exportCsvButton').disabled = window.latestReportData.length === 0 || !window.isAdmin;

        // Если Админ, рендерим графики и карту
        if (window.isAdmin) {
             renderLoyaltyChart(window.latestReportData);
             renderActionChart(window.latestReportData);
             if (window.mapInstance && typeof ymaps !== 'undefined') {
                 window.initMapMarkers(window.latestReportData);
             } else {
                 if (mapLoading) mapLoading.classList.add('hidden'); 
             }
        } else {
             // Если Агитатор, рендерим только список его отчетов
             window.renderAgitatorReports(window.latestReportData);
             if (mapLoading) mapLoading.classList.add('hidden'); 
        }

    } catch (error) {
        console.error("Ошибка при загрузке отчетов: ", error);
        window.showAlert('ОШИБКА ДАННЫХ', `Не удалось загрузить отчеты: ${error.message}.`);
        document.getElementById('reportStatus').textContent = '❌ Ошибка загрузки данных';
        if (mapLoading) mapLoading.classList.add('hidden');
    }
}

// ----------------------------------------------------------------------------------
// 2. ФУНКЦИЯ РЕНДЕРИНГА ОТЧЕТОВ АГИТАТОРА (с кнопкой редактирования)
// ----------------------------------------------------------------------------------

window.renderAgitatorReports = function(reportList) {
    const container = document.getElementById('agitatorReportsList');
    if (!container) return;
    
    container.innerHTML = ''; 
    
    if (reportList.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 p-6">Вы пока не внесли ни одного отчета.</p>';
        return;
    }
    
    const currentTime = new Date();

    reportList.forEach(report => {
        const reportTime = report.timestamp ? report.timestamp.toDate() : null;
        const diffMinutes = reportTime ? (currentTime.getTime() - reportTime.getTime()) / (1000 * 60) : Infinity;
        const canEdit = diffMinutes <= 30;
        
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-xl shadow mb-3 border-l-4 ' + (canEdit ? 'border-indigo-500' : 'border-gray-300');
        
        const timestampText = reportTime ? reportTime.toLocaleString('ru-RU') : 'Нет данных';
        const editStatus = canEdit ? 
            `<span class="text-sm font-semibold text-indigo-600">Доступно еще ${Math.max(0, 30 - Math.ceil(diffMinutes))} мин.</span>` :
            `<span class="text-sm font-semibold text-red-500">Редактирование закрыто</span>`;
            
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h3 class="font-bold text-gray-900">${report.settlement || ''}, ${report.address || 'Адрес не указан'}</h3>
                ${editStatus}
            </div>
            <p class="text-sm text-gray-600">Дата: ${timestampText}</p>
            <p class="text-sm text-gray-600">Лояльность: <b>${report.loyalty || '-'}</b>, Действие: <b>${report.action || '-'}</b></p>
            <p class="text-sm text-gray-600 mt-1 truncate">Комментарий: ${report.comment || 'Нет'}</p>
        `;
        
        if (canEdit) {
            const button = document.createElement('button');
            button.className = 'mt-3 text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center';
            button.innerHTML = '<span data-lucide="edit" class="w-4 h-4 mr-1"></span> Редактировать';
            // Вызов функции загрузки для редактирования из main.js
            button.onclick = () => window.loadReportForEdit(report.id); 
            card.appendChild(button);
        }
        
        container.appendChild(card);
    });
    lucide.createIcons(); // Обновление иконок
}


// ... (initMap, initMapMarkers, exportToCsv - остаются прежними) ...

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
            if (window.isAdmin) {
                window.fetchReports(selectedSettlement);
            }
        });
    }
});
