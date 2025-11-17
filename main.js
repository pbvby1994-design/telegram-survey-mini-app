// main.js (ФИНАЛЬНАЯ ВЕРСИЯ С АНИМАЦИЯМИ, PWA ОФФЛАЙН ЛОГИКОЙ И ARIA-ДОСТУПНОСТЬЮ)

// --- Глобальные переменные ---
window.mapInstance = null; 
let currentLatitude = null; 
let currentLongitude = null;
let dadataCoords = null;    

// --- КОНФИГУРАЦИЯ DADATA (Из URL-параметров) ---
const urlParams = new URLSearchParams(window.location.search);

// Ключ Dadata теперь передается как URL-параметр для безопасности.
const DADATA_API_KEY = urlParams.get('dadata_token'); 
// Используем FIAS ID для ограничения поиска.
const DADATA_LOCATION_FIAS_ID = urlParams.get('dadata_fias_id') || '86'; // '86' - дефолтное значение для ХМАО

let selectedSuggestionData = null; 

const addressInput = document.getElementById('address');
const suggestionsList = document.getElementById('suggestionsList');
const addressStatus = document.getElementById('addressStatus');

/**
 * Ручной обработчик ввода для Dadata
 */
if (addressInput) {
    if (!DADATA_API_KEY) {
        console.error("DADATA_API_KEY не найден в URL. Поиск адресов Dadata будет недоступен.");
        if (addressStatus) {
            addressStatus.textContent = '⚠️ API Dadata недоступно. Обратитесь к администратору.';
        }
        addressInput.disabled = true; 
    } else {
        // Ручной обработчик ввода для Dadata
        addressInput.addEventListener('input', async () => {
            const query = addressInput.value.trim();
            if (query.length < 3) {
                suggestionsList?.innerHTML = '';
                suggestionsList?.classList.add('hidden');
                addressInput.setAttribute('aria-expanded', 'false'); // ARIA
                return;
            }

            try {
                const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
                    method: "POST",
                    mode: "cors",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "Authorization": "Token " + DADATA_API_KEY
                    },
                    body: JSON.stringify({
                        query: query,
                        // Дополнительные параметры
                        count: 10,
                        locations: [
                            { 'kladr_id': DADATA_LOCATION_FIAS_ID } 
                        ],
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.suggestions && data.suggestions.length > 0) {
                    renderSuggestions(data.suggestions);
                    addressInput.setAttribute('aria-expanded', 'true'); // ARIA
                } else {
                    suggestionsList?.innerHTML = '';
                    suggestionsList?.classList.add('hidden');
                    addressInput.setAttribute('aria-expanded', 'false'); // ARIA
                }
            } catch (error) {
                console.error("Dadata API call failed:", error);
                suggestionsList?.innerHTML = `<li class="p-2 text-red-500 text-sm" role="alert">Ошибка загрузки адресов. ${error.message}</li>`;
                suggestionsList?.classList.remove('hidden');
                addressInput.setAttribute('aria-expanded', 'true'); // ARIA
            }
        });

        // Функция отрисовки подсказок
        function renderSuggestions(suggestions) {
            if (!suggestionsList) return;
            suggestionsList.innerHTML = '';
            suggestionsList.classList.remove('hidden');

            suggestions.forEach(suggestion => {
                const li = document.createElement('li');
                li.className = 'p-2 cursor-pointer hover:bg-indigo-100 text-sm text-gray-700';
                li.textContent = suggestion.value;
                li.setAttribute('role', 'option'); // ARIA
                li.onclick = () => selectSuggestion(suggestion);
                suggestionsList.appendChild(li);
            });
        }

        // Функция выбора подсказки
        function selectSuggestion(suggestion) {
            selectedSuggestionData = suggestion.data;
            addressInput.value = suggestion.value;
            suggestionsList?.innerHTML = '';
            suggestionsList?.classList.add('hidden');
            addressInput.setAttribute('aria-expanded', 'false'); // ARIA

            // Сохранение координат
            dadataCoords = {
                lat: suggestion.data.geo_lat,
                lon: suggestion.data.geo_lon
            };
            if (addressStatus) {
                addressStatus.textContent = dadataCoords.lat && dadataCoords.lon ? 
                    `Координаты: ${dadataCoords.lat}, ${dadataCoords.lon}` : 
                    'Координаты не найдены.';
            }
        }

        // Закрытие списка подсказок при клике вне
        document.addEventListener('click', (e) => {
            if (suggestionsList && !suggestionsList.contains(e.target) && e.target !== addressInput) {
                suggestionsList.classList.add('hidden');
                addressInput.setAttribute('aria-expanded', 'false'); // ARIA
            }
        });
    }
}


// --- ФУНКЦИИ ИНТЕРФЕЙСА (ОБНОВЛЕНО ARIA) ---

/**
 * Переключает активный раздел дашборда с анимацией.
 * @param {string} sectionId ID раздела, который нужно показать.
 */
window.showSection = function(sectionId) {
    const sections = document.querySelectorAll('.dashboard-section');
    const buttons = document.querySelectorAll('.tab-button');
    const targetSection = document.getElementById(sectionId);
    
    sections.forEach(section => {
        const isTarget = section.id === sectionId;
        section.classList.toggle('hidden', !isTarget);
        section.classList.toggle('active-tab', isTarget);
        section.setAttribute('aria-hidden', !isTarget); // ARIA: Скрываем неактивные разделы
    });
    
    buttons.forEach(button => {
        const isTarget = button.id === `btn-${sectionId}`;
        
        // Обновление стилей
        button.classList.toggle('active', isTarget);
        button.classList.toggle('bg-indigo-600', isTarget);
        button.classList.toggle('text-white', isTarget);
        button.classList.toggle('text-zinc-600', !isTarget);
        button.classList.toggle('hover:bg-indigo-100', !isTarget);
        
        // ARIA: Обновление состояния табов
        button.setAttribute('aria-selected', isTarget);
        button.setAttribute('tabindex', isTarget ? '0' : '-1'); // ARIA: Только активный таб доступен для фокуса
        
        if (isTarget) {
            button.focus(); // Устанавливаем фокус на активный таб для удобства
        }
    });
    
    if (targetSection) {
        // Анимация
        targetSection.style.opacity = 0; 
        setTimeout(() => {
            targetSection.style.opacity = 1;
        }, 10); 
        
        // Логика для карты (Яндекс)
        if (window.mapInstance && sectionId === 'map-view') {
             window.mapInstance.container.fitToViewport();
        }
    } else {
         document.getElementById('mapLoading')?.classList.add('hidden');
    }
    
    lucide.createIcons();
}

/**
 * Инициализирует Yandex Map.
 * Вызывается асинхронно через глобальный колбэк ymapsReadyCallback в HTML.
 */
window.initMap = function() {
    if (window.mapInstance) return;

    try {
        ymaps.ready(() => {
            const mapLoading = document.getElementById('mapLoading');
            if (mapLoading) mapLoading.classList.add('hidden');

            // Центр ХМАО
            window.mapInstance = new ymaps.Map('map', {
                center: [61.25, 73.4], 
                zoom: 7,
                controls: ['zoomControl', 'fullscreenControl']
            });
            
            console.log("Yandex Map инициализирована.");
            
            // Загрузка данных после инициализации (если это админ)
            if (window.isAdmin && window.loadMapData) {
                window.loadMapData(); 
            }
        });
    } catch (e) {
        console.error("Ошибка инициализации Yandex Maps:", e);
        document.getElementById('mapLoading').textContent = "❌ Ошибка загрузки карты.";
        document.getElementById('mapLoading').setAttribute('role', 'alert'); // ARIA
    }
};

/**
 * Обработка отправки формы.
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    const saveButton = document.getElementById('saveButton');
    saveButton.disabled = true;
    saveButton.innerHTML = '<svg data-lucide="loader" class="w-5 h-5 mr-2 animate-spin" aria-hidden="true"></svg> Отправка...';
    lucide.createIcons();

    const reportData = {
        settlement: document.getElementById('settlement').value,
        address: selectedSuggestionData?.value || document.getElementById('address').value,
        loyalty: document.querySelector('input[name="loyalty"]:checked')?.value,
        action: document.getElementById('action').value,
        comment: document.getElementById('comment').value.trim(),
        
        latitude: dadataCoords?.lat || null,
        longitude: dadataCoords?.lon || null,

        user_id: window.userTelegramId,
        username: window.userTelegramUsername || 'anonymous',
        
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // 1. Проверяем статус сети
    if (!navigator.onLine) {
        try {
            const key = await window.saveOfflineReport(reportData);
            window.showAlert('ОТЧЕТ СОХРАНЕН', `Нет подключения к сети. Отчет временно сохранен локально (ID: ${key}). Он будет отправлен при восстановлении сети.`);
            document.getElementById('reportForm').reset();
            saveButton.innerHTML = '<svg data-lucide="send" class="w-5 h-5 mr-2" aria-hidden="true"></svg> Сохранить отчет';
        } catch (error) {
            console.error("Failed to save report to IndexedDB:", error);
            window.showAlert('Ошибка', 'Не удалось сохранить отчет локально. Пожалуйста, попробуйте еще раз.');
            saveButton.innerHTML = '<svg data-lucide="send" class="w-5 h-5 mr-2" aria-hidden="true"></svg> Сохранить отчет';
        }
        saveButton.disabled = false;
        lucide.createIcons();
        selectedSuggestionData = null; 
        dadataCoords = null;
        if (addressStatus) addressStatus.textContent = '';
        return;
    }
    
    // 2. Если онлайн, пытаемся отправить в Firebase
    try {
        if (!window.db) {
            throw new Error("Firebase DB not initialized.");
        }
        
        const docRef = await window.db.collection('reports').add(reportData);
        window.Telegram.WebApp.sendData(JSON.stringify({ 
            status: 'report_saved', 
            reportId: docRef.id 
        }));

        window.showAlert('Успех', 'Отчет успешно отправлен!');
        document.getElementById('reportForm').reset();
        
        selectedSuggestionData = null; 
        dadataCoords = null;
        if (addressStatus) addressStatus.textContent = '';
        
        await syncOfflineReports();
        
    } catch (error) {
        console.error("Firebase save failed:", error);
        
        if (error.code !== 'permission-denied' && typeof window.saveOfflineReport === 'function') {
             try {
                const localData = {...reportData};
                delete localData.timestamp; 
                const key = await window.saveOfflineReport(localData);
                
                window.showAlert('СБОЙ СЕТИ / ОФФЛАЙН-СОХРАНЕНИЕ', `Ошибка отправки в Firebase. Отчет сохранен локально (ID: ${key}). Он будет отправлен при восстановлении сети.`);
                document.getElementById('reportForm').reset(); 
                selectedSuggestionData = null; 
                dadataCoords = null;
                if (addressStatus) addressStatus.textContent = '';
                
            } catch (localError) {
                console.error("Failed fallback save to IndexedDB:", localError);
                window.showAlert('Критическая ошибка', 'Не удалось сохранить отчет ни в Firebase, ни локально.');
            }
        } else {
             window.showAlert('Ошибка отправки', `Не удалось отправить отчет: ${error.message}.`);
        }
    } finally {
        saveButton.innerHTML = '<svg data-lucide="send" class="w-5 h-5 mr-2" aria-hidden="true"></svg> Сохранить отчет';
        saveButton.disabled = false;
        lucide.createIcons();
        window.updateMyReportsView(); 
        window.loadReports(window.isAdmin ? 'all' : 'my'); 
    }
}


// --- ИНИЦИАЛИЗАЦИЯ ДАШБОРДА (УСИЛЕННЫЙ TRY-CATCH) ---

window.loadDashboard = async function() {
    try {
        // 1. Заполнение списка населенных пунктов
        const settlementSelect = document.getElementById('settlement');
        if (settlementSelect && window.SETTLEMENTS) {
            window.SETTLEMENTS.forEach(settlement => {
                const option = document.createElement('option');
                option.value = settlement;
                option.textContent = settlement;
                settlementSelect.appendChild(option);
            });
        }

        // 2. Получение роли
        const isAuth = await window.authenticateWithCustomToken();
        const urlParams = new URLSearchParams(window.location.search);
        const initialView = urlParams.get('view') || 'form-view';
        const urlRole = urlParams.get('role'); // Может быть 'admin' или 'reporter'

        if (isAuth) {
            // Обновление UI
            document.getElementById('authUsername').textContent = window.userTelegramUsername || window.userTelegramId;
            document.getElementById('authId').textContent = window.userTelegramId;
            
            // 3. Настройка видимости табов в зависимости от роли
            if (window.isAdmin) {
                // Админ видит все
                document.getElementById('btn-map-view')?.classList.remove('hidden');
                document.getElementById('btn-stats')?.classList.remove('hidden');
                document.getElementById('btn-raw-data')?.classList.remove('hidden');
                document.getElementById('exportCsvButton')?.classList.remove('hidden');
                document.getElementById('btn-my-reports-view')?.classList.add('hidden');
                
                // Заполнение фильтра статистики
                const settlementStatsFilter = document.getElementById('settlementStatsFilter');
                if (settlementStatsFilter) {
                    window.SETTLEMENTS.forEach(settlement => {
                        const option = document.createElement('option');
                        option.value = settlement;
                        option.textContent = settlement;
                        settlementStatsFilter.appendChild(option);
                    });
                }

            } else {
                // Агитатор видит только Форму и Мои Отчеты
                document.getElementById('btn-map-view')?.classList.add('hidden');
                document.getElementById('btn-stats')?.classList.add('hidden');
                document.getElementById('btn-raw-data')?.classList.add('hidden');
                document.getElementById('exportCsvButton')?.classList.add('hidden');
                document.getElementById('btn-my-reports-view')?.classList.remove('hidden');
            }

            // 4. Выбор начального раздела
            let startSection = initialView;
            
            if (window.isAdmin && startSection === 'form-view') {
                 startSection = 'map-view';
            }
            
            if (!window.isAdmin && (startSection === 'map-view' || startSection === 'stats' || startSection === 'raw-data')) {
                 startSection = 'form-view';
            }

            // 5. [НОВОЕ] Добавляем прослушиватели событий для автоматической синхронизации
            window.addEventListener('online', syncOfflineReports);
            // Добавляем обработчик отправки формы
            document.getElementById('reportForm')?.addEventListener('submit', handleFormSubmit);

            // 6. Загрузка данных (для админов и агитаторов)
            if (window.loadReports) {
                 await window.loadReports(window.isAdmin ? 'all' : 'my');
                 
                 // 7. Сразу пытаемся синхронизировать оффлайн-отчеты при первой загрузке
                 await syncOfflineReports(); 
            }

            // 8. Отображение раздела
            window.showSection(startSection);
            document.getElementById('saveButton')?.removeAttribute('disabled');
            
        } else {
             window.showSection('form-view');
             document.getElementById('saveButton')?.setAttribute('disabled', 'true');
             window.showAlert('Доступ ограничен', 'Не удалось пройти аутентификацию. Используйте бота для входа.');
             document.getElementById('authUsername').textContent = 'Не авторизован';
             document.getElementById('authId').textContent = '—';
        }
    } catch (e) {
        console.error("Критическая ошибка при загрузке панели:", e);
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', `Не удалось загрузить панель из-за внутренней ошибки: ${e.message}.`);
        document.getElementById('saveButton')?.setAttribute('disabled', 'true');
        // Показываем дефолтный раздел, если все сломалось
        window.showSection('form-view'); 
    }
}

/**
 * Пытается синхронизировать все оффлайн-отчеты с Firebase.
 */
async function syncOfflineReports() {
    if (!navigator.onLine || !window.db || typeof window.getOfflineReports !== 'function') {
        return; 
    }

    const offlineReports = await window.getOfflineReports();
    if (offlineReports.length === 0) {
        return; 
    }
    
    console.log(`Найдено ${offlineReports.length} оффлайн-отчетов для синхронизации.`);
    
    let syncCount = 0;
    
    offlineReports.sort((a, b) => a.data.saved_at - b.data.saved_at);

    for (const { key, data: report } of offlineReports) {
        const reportData = { ...report };
        delete reportData.saved_at; 
        reportData.timestamp = firebase.firestore.FieldValue.serverTimestamp(); 
        
        try {
            await window.db.collection('reports').add(reportData);
            await window.deleteOfflineReport(key);
            
            syncCount++;
            console.log(`Отчет (IDB Key: ${key}) успешно синхронизирован и удален из локального хранилища.`);
            
        } catch (error) {
            // Если не удалось отправить, прекращаем попытки, чтобы не спамить
            console.warn(`Сбой синхронизации отчета (IDB Key: ${key}):`, error.message);
            break; 
        }
    }
    
    if (syncCount > 0) {
        window.showAlert('СИНХРОНИЗАЦИЯ', `✅ Успешно отправлено ${syncCount} оффлайн-отчетов в Firebase.`);
        if (window.loadReports) {
            await window.loadReports(window.isAdmin ? 'all' : 'my');
        }
    }
}
