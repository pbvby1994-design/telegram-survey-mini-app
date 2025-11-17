// reports.js (ES Module)
import { db, isAdmin, userTelegramId } from './firebase-auth.js';
import { showAlert } from './utils.js';

// --- Модульные переменные ---
let loyaltyChartInstance = null; 
let actionChartInstance = null; 
let allReportsData = []; // Сырые данные всех отчетов (для админа)
export let latestReportData = []; // Отфильтрованные/активные данные отчетов для отображения

// Экспортируем список населенных пунктов
export const SETTLEMENTS = [ 
    'г.п. Лянтор', 'с.п. Русскинская', 'г.п. Федоровский', 'г.п. Барсово', 
    'г.п. Белый Яр', 'с.п. Лямина', 'с.п. Сытомино', 'с.п. Угут', 
    'с.п. Ульт-Ягун', 'с.п. Солнечный', 'с.п. Нижнесортымский', 
    'с.п. Тундрино', 'с.п. Локосово'
];

// ... mapLoyalty и mapAction остались без изменений ...
export function mapLoyalty(key) {
    switch (key) {
        case 'strong': return '1. Убежденный сторонник';
        case 'moderate': return '2. Умеренный сторонник';
        case 'neutral': return '3. Нейтральный';
        case 'against': return '4. Противник';
        default: return key;
    }
}
function mapAction(key) {
    switch (key) {
        case 'appeal': return '1. Передал листовку/Призыв';
        case 'information': return '2. Только информировал';
        case 'refused': return '3. Отказались говорить/принять';
        case 'other': return '4. Другое';
        default: return key;
    }
}

// ... renderLoyaltyChart и renderActionChart остались без изменений ...

// ----------------------------------------------------------------------------------
// ФУНКЦИИ ОТОБРАЖЕНИЯ СПИСКОВ И ТАБЛИЦ (Добавлена Локализация)
// ----------------------------------------------------------------------------------

/**
 * Рендерит список отчетов в разделе "Мои Отчеты"
 * @param {Array<object>} reportList 
 */
export function renderMyReports(reportList) {
    const container = document.getElementById('myReportsList');
    if (!container) return;

    container.innerHTML = ''; 

    if (reportList.length === 0) {
        container.innerHTML = `<p class="text-gray-500 dark:text-zinc-400">Список пуст. Вы ещё не добавили отчетов.</p>`;
        return;
    }
    
    // ЛОКАЛИЗАЦИЯ ДАТ (i18n)
    const dateFormatter = new Intl.DateTimeFormat('ru-RU', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    reportList.forEach(report => {
        let dateToFormat = report.timestamp ? (report.timestamp.toDate ? report.timestamp.toDate() : new Date(report.timestamp)) : new Date();
        const formattedDate = dateFormatter.format(dateToFormat);

        // ... генерация HTML-карточки ...
        // (Остальной код рендеринга карточки без изменений, используйте его из оригинального файла)
        const loyaltyText = mapLoyalty(report.loyalty);
        const actionText = mapAction(report.action);

        const colorClass = report.loyalty === 'strong' ? 'border-blue-500' :
                           report.loyalty === 'moderate' ? 'border-green-500' :
                           report.loyalty === 'against' ? 'border-red-500' : 'border-yellow-500';

        const reportCard = document.createElement('div');
        reportCard.className = `p-4 border-l-4 ${colorClass} bg-white dark:bg-zinc-700 rounded-lg shadow-sm stagger-item`;
        
        reportCard.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <p class="text-xs font-semibold text-gray-500 dark:text-zinc-400">${formattedDate}</p>
                <span class="text-xs font-medium text-indigo-600 dark:text-indigo-300">
                    ${report.username || 'Агитатор'}
                </span>
            </div>
            <p class="text-lg font-bold text-gray-800 dark:text-white mb-2">${report.address}</p>
            <div class="text-sm space-y-1">
                <p class="text-gray-700 dark:text-zinc-300"><strong>Лояльность:</strong> ${loyaltyText}</p>
                <p class="text-gray-700 dark:text-zinc-300"><strong>Действие:</strong> ${actionText}</p>
                ${report.comment ? `<p class="text-gray-700 dark:text-zinc-300 mt-2"><strong>Комм:</strong> ${report.comment}</p>` : ''}
            </div>
        `;
        container.appendChild(reportCard);
    });
}

/**
 * Рендерит список отчетов в разделе "Сырые Данные" (для админа)
 * @param {Array<object>} reportList 
 */
export function renderRawData(reportList) {
    const tableBody = document.getElementById('rawDataTableBody');
    const noDataMessage = document.getElementById('noDataMessage');
    if (!tableBody || !noDataMessage) return;

    tableBody.innerHTML = '';
    noDataMessage.classList.add('hidden');

    if (reportList.length === 0) {
        noDataMessage.classList.remove('hidden');
        return;
    }

    // ЛОКАЛИЗАЦИЯ ДАТ (i18n)
    const dateFormatter = new Intl.DateTimeFormat('ru-RU', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    reportList.forEach(report => {
        let dateToFormat = report.timestamp ? (report.timestamp.toDate ? report.timestamp.toDate() : new Date(report.timestamp)) : new Date();
        const formattedDate = dateFormatter.format(dateToFormat);

        // ... генерация HTML-строки таблицы ...
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors stagger-item';
        
        row.innerHTML = `
            <td class="py-2 px-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">${formattedDate}</td>
            <td class="py-2 px-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">${report.settlement || '-'}</td>
            <td class="py-2 px-3 text-sm text-gray-900 dark:text-white">${report.address || '-'}</td>
            <td class="py-2 px-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">${mapLoyalty(report.loyalty)}</td>
            <td class="py-2 px-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">${mapAction(report.action)}</td>
            <td class="py-2 px-3 text-sm text-gray-500 dark:text-zinc-400">${report.comment || '-'}</td>
        `;
        tableBody.appendChild(row);
    });
}

// ----------------------------------------------------------------------------------
// ФУНКЦИЯ ЗАГРУЗКИ ДАННЫХ И ЭКСПОРТА (Теперь экспортируются)
// ----------------------------------------------------------------------------------

export async function loadReports(mode) {
    // ... логика загрузки из Firebase ...
    if (!db) {
        showAlert('ОШИБКА', 'База данных Firebase не инициализирована.');
        return;
    }
    
    try {
        let query = db.collection('reports').orderBy('timestamp', 'desc');

        if (mode === 'my') {
            if (!userTelegramId) return;
            query = query.where('user_id', '==', userTelegramId);
        }

        const snapshot = await query.get();
        
        allReportsData = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            timestamp: doc.data().timestamp || new Date() 
        }));
        
        applySettlementFilter(document.getElementById('settlementFilter')?.value || 'all'); 

    } catch (error) {
        console.error("Error loading reports:", error);
        showAlert('ОШИБКА ЗАГРУЗКИ', `Не удалось загрузить отчеты: ${error.message}`);
    }
}

// ... applySettlementFilter (внутренняя функция) осталась без изменений ...

/**
 * Экспортирует текущие отфильтрованные данные в CSV 
 * (Оставлен как window.exportToCsv для совместимости с onclick в HTML)
 */
window.exportToCsv = function() {
    // ... логика экспорта CSV ...
    if (latestReportData.length === 0) {
        showAlert('Экспорт', 'Нет данных для экспорта.');
        return;
    }

    const headers = [
        'id', 'timestamp', 'username', 'user_id', 'settlement', 
        'address', 'loyalty', 'action', 'comment', 'latitude', 'longitude'
    ];

    const rows = latestReportData.map(r => {
        let dateToFormat = r.timestamp ? (r.timestamp.toDate ? r.timestamp.toDate() : new Date(r.timestamp)) : new Date();
        const isoString = dateToFormat.toISOString();

        return [
            r.id, isoString, r.username || '', r.user_id || '', r.settlement || '',
            r.address || '', r.loyalty || '', r.action || '',
            (r.comment || '').replace(/"/g, '""'), r.latitude || '', r.longitude || ''
        ]
    });

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
    
    showAlert('Экспорт', `✅ Экспортировано ${latestReportData.length} отчетов.`);
}

/**
 * Заполняет выпадающие списки населенными пунктами и настраивает фильтр.
 */
export function initSettlementSelects() {
    // ... логика заполнения списков НП ...
}
