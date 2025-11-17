// utils.js (ES Module)

/**
 * Управляет отображением модального окна оповещения (с поддержкой ARIA)
 * @param {string} title - Заголовок оповещения
 * @param {string} message - Текст сообщения
 */
export function showAlert(title, message) {
    const modal = document.getElementById('alertModal');
    const titleEl = document.getElementById('alertTitle');
    const messageEl = document.getElementById('alertMessage');
    const liveRegion = document.getElementById('alertLiveRegion');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;

    if (modal) {
        // Управление видимостью с помощью классов (для анимации/плавного перехода)
        modal.classList.remove('hidden', 'opacity-0');
        modal.classList.add('flex', 'opacity-100');
    }

    // ARIA Live Region: для уведомления скринридеров
    if (liveRegion) {
        liveRegion.textContent = `${title}. ${message}`;
    }

    if (window.Telegram.WebApp && window.Telegram.WebApp.showAlert) {
         window.Telegram.WebApp.showAlert(`${title}: ${message}`);
    }
}

/**
 * Закрывает модальное окно оповещения
 * (Оставлен как window.closeAlert для совместимости с onclick в HTML)
 */
window.closeAlert = function() {
    const modal = document.getElementById('alertModal');
    if (modal) {
        modal.classList.remove('flex', 'opacity-100');
        modal.classList.add('hidden', 'opacity-0');
    }
}

/**
 * Переключает видимость секций на дашборде
 * @param {string} sectionId - ID секции для показа (e.g., 'form-view')
 * @param {HTMLElement} [clickedButton=null] - Кнопка, на которую нажали (для стилей)
 */
export function showSection(sectionId, clickedButton = null) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });

    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');

        // Анимация stagger при переключении
        setTimeout(() => {
            targetSection.classList.add('loaded');
            targetSection.querySelectorAll('.stagger-item').forEach((item, index) => {
                item.classList.remove('loaded');
                setTimeout(() => {
                    item.classList.add('loaded');
                }, 50 * index);
            });
        }, 10);
    }

    // Обновление стилей навигационных кнопок
    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.classList.remove('text-indigo-600', 'bg-indigo-100', 'dark:bg-indigo-800', 'dark:text-white');
        btn.classList.add('text-gray-500', 'hover:bg-gray-100', 'dark:text-zinc-400', 'dark:hover:bg-zinc-700');
    });

    if (clickedButton) {
        clickedButton.classList.remove('text-gray-500', 'hover:bg-gray-100', 'dark:text-zinc-400', 'dark:hover:bg-zinc-700');
        clickedButton.classList.add('text-indigo-600', 'bg-indigo-100', 'dark:bg-indigo-800', 'dark:text-white');
    } else {
         // Обновляем активный статус при загрузке
         const activeBtn = document.getElementById(`btn-${sectionId}`);
         if (activeBtn) {
            activeBtn.classList.remove('text-gray-500', 'hover:bg-gray-100', 'dark:text-zinc-400', 'dark:hover:bg-zinc-700');
            activeBtn.classList.add('text-indigo-600', 'bg-indigo-100', 'dark:bg-indigo-800', 'dark:text-white');
         }
    }

    // Специальная обработка для карты (Yandex Maps)
    if (window.mapInstance && sectionId === 'map-view') {
        window.mapInstance.container.fitToViewport();
    }
}


/**
 * Проверяет и инициализирует темную тему при загрузке
 */
export function initDarkMode() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const storedTheme = localStorage.getItem('theme');

    if (storedTheme === 'dark' || (storedTheme === null && prefersDark)) {
        document.documentElement.classList.add('dark');
        updateDarkModeIcon('sun');
    } else {
        document.documentElement.classList.remove('dark');
        updateDarkModeIcon('moon');
    }
}

/**
 * Переключает темную/светлую тему
 * (Оставлен как window.toggleDarkMode для совместимости с onclick в HTML)
 */
window.toggleDarkMode = function() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateDarkModeIcon(isDark ? 'sun' : 'moon');

    // Обновляем карту, если она открыта
    if (window.mapInstance) {
         window.mapInstance.container.fitToViewport();
    }
}

/**
 * Обновляет иконку кнопки переключения темы
 * @param {'moon'|'sun'} iconName
 */
function updateDarkModeIcon(iconName) {
    const iconContainer = document.getElementById('darkModeIcon');
    if (iconContainer) {
        iconContainer.dataset.lucide = iconName;
        // Перерисовываем иконку Lucide
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
             lucide.createIcons();
        }
    }
}