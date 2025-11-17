// main.js (ФИНАЛЬНАЯ ВЕРСИЯ С АНИМАЦИЯМИ И PWA ОФФЛАЙН ЛОГИКОЙ)

// --- Глобальные переменные ---
window.mapInstance = null; 
let currentLatitude = null; 
let currentLongitude = null;
let dadataCoords = null;    

// --- КОНФИГУРАЦИЯ DADATA (Из config.js) ---
const DADATA_API_KEY = '29c85666d57139f459e452d1290dd73c23708472'; 
// Используем FIAS ID ХМАО для ограничения поиска, если он передан из бота.
const DADATA_LOCATION_FIAS_ID = new URLSearchParams(window.location.search).get('dadata_fias_id') || '86';

let selectedSuggestionData = null; 

const addressInput = document.getElementById('address');
const suggestionsList = document.getElementById('suggestionsList');

/**
 * Ручной обработчик ввода для Dadata
 */
if (addressInput) {
    // Ручной обработчик ввода для Dadata
    addressInput.addEventListener('input', async () => {
        const query = addressInput.value.trim();
        if (query.length < 3) {
            suggestionsList?.innerHTML = '';
            suggestionsList?.classList.add('hidden');
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
                        { 'kladr_id': DADATA_LOCATION_FIAS_ID } // Ограничение по ХМАО
                    ],
                })
            });
            const data = await response.json();
            
            if (data.suggestions && data.suggestions.length > 0) {
                renderSuggestions(data.suggestions);
            } else {
                suggestionsList?.innerHTML = '';
                suggestionsList?.classList.add('hidden');
            }
        } catch (error) {
            console.error("Dadata API call failed:", error);
            suggestionsList?.innerHTML = `<li class="p-2 text-red-500 text-sm">Ошибка загрузки адресов.</li>`;
            suggestionsList?.classList.remove('hidden');
        }
    });

    // Функция отрисовки подсказок
    function renderSuggestions(suggestions) {
        suggestionsList.innerHTML = '';
        suggestionsList.classList.remove('hidden');

        suggestions.forEach(suggestion => {
            const li = document.createElement('li');
            li.className = 'p-2 cursor-pointer hover:bg-indigo-100 text-sm text-gray-700';
            li.textContent = suggestion.value;
            li.onclick = () => selectSuggestion(suggestion);
            suggestionsList.appendChild(li);
        });
    }

    // Функция выбора подсказки
    function selectSuggestion(suggestion) {
        selectedSuggestionData = suggestion.data;
        addressInput.value = suggestion.value;
        suggestionsList.innerHTML = '';
        suggestionsList.classList.add('hidden');

        // Сохранение координат
        dadataCoords = {
            lat: suggestion.data.geo_lat,
            lon: suggestion.data.geo_lon
        };
        document.getElementById('addressStatus').textContent = dadataCoords.lat && dadataCoords.lon ? 
            `Координаты: ${dadataCoords.lat}, ${dadataCoords.lon}` : 
            'Координаты не найдены.';
    }

    // Закрытие списка подсказок при клике вне
    document.addEventListener('click', (e) => {
        if (suggestionsList && !suggestionsList.contains(e.target) && e.target !== addressInput) {
            suggestionsList.classList.add('hidden');
        }
    });
}


// --- ФУНКЦИИ ИНТЕРФЕЙСА ---

/**
 * Переключает активный раздел дашборда с анимацией.
 * @param {string} sectionId ID раздела, который нужно показать.
 */
window.showSection = function(sectionId) {
    const sections = document.querySelectorAll('.dashboard-section');
    const buttons = document.querySelectorAll('.tab-button');
    const targetSection = document.getElementById(sectionId);
    
    sections.forEach(section => {
        if (section.id !== sectionId) {
            section.classList.add('hidden');
            section.classList.remove('active-tab');
        }
    });
    
    buttons.forEach(button => {
        button.classList.remove('active', 'bg-indigo-600', 'text-white');
        button.classList.add('text-zinc-600');
        button.classList.remove('hover:bg-indigo-100');
        
        if (button.id === `btn-${sectionId}`) {
            button.classList.add('active', 'bg-indigo-600', 'text-white');
            button.classList.remove('text-zinc-600');
        } else {
             button.classList.add('hover:bg-indigo-100');
        }
    });
    
    if (targetSection) {
        // Установка opacity 0 для плавной анимации
        targetSection.style.opacity = 0; 
        targetSection.classList.remove('hidden');
        
        // Маленькая задержка для срабатывания transition
        setTimeout(() => {
            targetSection.style.opacity = 1;
        }, 10); 
        
        // Логика для карты (Яндекс)
        if (window.mapInstance && sectionId === 'map-view') {
             // Принудительно подгоняем карту под размер контейнера после переключения
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
    }
};

// ----------------------------------------------------------------------
// НОВАЯ ФУНКЦИЯ: СИНХРОНИЗАЦИЯ ОФФЛАЙН-ОТЧЕТОВ
// ----------------------------------------------------------------------

/**
 * Пытается синхронизировать все оффлайн-отчеты с Firebase.
 */
async function syncOfflineReports() {
    if (!navigator.onLine || !window.db || typeof window.getOfflineReports !== 'function') {
        // Условие для выхода: оффлайн или нет доступа к DB/IndexedDB
        return; 
    }

    const offlineReports = await window.getOfflineReports();
    if (offlineReports.length === 0) {
        return; // Нет отчетов для синхронизации
    }
    
    console.log(`Найдено ${offlineReports.length} оффлайн-отчетов для синхронизации.`);
    
    let syncCount = 0;
    
    // Сортировка по времени сохранения (сначала старые)
    offlineReports.sort((a, b) => a.data.saved_at - b.data.saved_at);

    for (const { key, data: report } of offlineReports) {
        // Удаляем временные поля, добавленные для IndexedDB
        const reportData = { ...report };
        delete reportData.saved_at; 
        
        // Для Firestore ServerTimestamp нужно использовать специальное значение
        reportData.timestamp = firebase.firestore.FieldValue.serverTimestamp(); 
        
        try {
            // 1. Отправка в Firebase
            await window.db.collection('reports').add(reportData);
            
            // 2. Удаление из IndexedDB после успешной отправки
            await window.deleteOfflineReport(key);
            
            syncCount++;
            console.log(`Отчет (IDB Key: ${key}) успешно синхронизирован и удален из локального хранилища.`);
            
        } catch (error) {
            console.warn(`Сбой синхронизации отчета (IDB Key: ${key}):`, error.message);
            // Если ошибка, останавливаем синхронизацию, предполагая, что сеть снова отвалилась
            break; 
        }
    }
    
    if (syncCount > 0) {
        window.showAlert('СИНХРОНИЗАЦИЯ', `✅ Успешно отправлено ${syncCount} оффлайн-отчетов в Firebase.`);
        // Обновляем список отчетов после синхронизации
        if (window.loadReports) {
            await window.loadReports(window.isAdmin ? 'all' : 'my');
        }
    }
}


// --- ОБРАБОТКА ФОРМЫ (ОБНОВЛЕННАЯ ЛОГИКА) ---

const reportForm = document.getElementById('reportForm');
if (reportForm) {
    reportForm.addEventListener('submit', handleFormSubmit);
}

/**
 * Обработка отправки формы.
 * Добавлена логика оффлайн-сохранения (IndexedDB).
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    const saveButton = document.getElementById('saveButton');
    saveButton.disabled = true;
    saveButton.innerHTML = '<svg data-lucide="loader" class="w-5 h-5 mr-2 animate-spin"></svg> Отправка...';
    lucide.createIcons();

    const reportData = {
        settlement: document.getElementById('settlement').value,
        address: selectedSuggestionData?.value || document.getElementById('address').value,
        loyalty: document.querySelector('input[name="loyalty"]:checked')?.value,
        action: document.getElementById('action').value,
        comment: document.getElementById('comment').value.trim(),
        
        // Добавление координат
        latitude: dadataCoords?.lat || null,
        longitude: dadataCoords?.lon || null,

        // Добавление данных пользователя
        user_id: window.userTelegramId,
        username: window.userTelegramUsername || 'anonymous',
        
        // Добавление метки времени
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    // --- ЛОГИКА ОФФЛАЙН / СИНХРОНИЗАЦИИ ---
    
    // 1. Проверяем статус сети
    if (!navigator.onLine) {
        try {
            // Если оффлайн, сохраняем в IndexedDB
            const key = await window.saveOfflineReport(reportData);
            window.showAlert('ОТЧЕТ СОХРАНЕН', `Нет подключения к сети. Отчет временно сохранен локально (ID: ${key}). Он будет отправлен при восстановлении сети.`);
            document.getElementById('reportForm').reset();
            saveButton.innerHTML = '<svg data-lucide="send" class="w-5 h-5 mr-2"></svg> Сохранить отчет';
            saveButton.disabled = false;
            lucide.createIcons();
            // Сброс данных Dadata после успешной отправки
            selectedSuggestionData = null; 
            dadataCoords = null;
            document.getElementById('addressStatus').textContent = '';
            return;
        } catch (error) {
            console.error("Failed to save report to IndexedDB:", error);
            window.showAlert('Ошибка', 'Не удалось сохранить отчет локально. Пожалуйста, попробуйте еще раз.');
            // В случае критической ошибки, позволяем повторную попытку
            saveButton.innerHTML = '<svg data-lucide="send" class="w-5 h-5 mr-2"></svg> Сохранить отчет';
            saveButton.disabled = false;
            lucide.createIcons();
            return;
        }
    }
    
    // 2. Если онлайн, пытаемся отправить в Firebase
    try {
        if (!window.db) {
            throw new Error("Firebase DB not initialized.");
        }
        
        const docRef = await window.db.collection('reports').add(reportData);
        
        // Оповещение Telegram Bot об успешном сохранении
        window.Telegram.WebApp.sendData(JSON.stringify({ 
            status: 'report_saved', 
            reportId: docRef.id 
        }));

        window.showAlert('Успех', 'Отчет успешно отправлен!');
        document.getElementById('reportForm').reset();
        
        // Сброс данных Dadata после успешной отправки
        selectedSuggestionData = null; 
        dadataCoords = null;
        document.getElementById('addressStatus').textContent = '';
        
        // После успешной отправки формы, запускаем синхронизацию (если остались старые оффлайн-отчеты)
        await syncOfflineReports();
        
    } catch (error) {
        console.error("Firebase save failed:", error);
        
        // Если отправка в Firebase не удалась (например, из-за временного сбоя сети на стороне Firebase), 
        // пробуем сохранить локально как резервный вариант.
        if (error.code !== 'permission-denied' && typeof window.saveOfflineReport === 'function') {
             try {
                // Временно меняем timestamp на метку сохранения
                const localData = {...reportData};
                delete localData.timestamp; 
                const key = await window.saveOfflineReport(localData);
                
                window.showAlert('СБОЙ СЕТИ / ОФФЛАЙН-СОХРАНЕНИЕ', `Ошибка отправки в Firebase. Отчет сохранен локально (ID: ${key}). Он будет отправлен при восстановлении сети.`);
                document.getElementById('reportForm').reset(); // Сброс формы после локального сохранения
                // Сброс данных Dadata после успешной отправки
                selectedSuggestionData = null; 
                dadataCoords = null;
                document.getElementById('addressStatus').textContent = '';
                
            } catch (localError) {
                console.error("Failed fallback save to IndexedDB:", localError);
                window.showAlert('Критическая ошибка', 'Не удалось сохранить отчет ни в Firebase, ни локально.');
            }
        } else {
             window.showAlert('Ошибка отправки', `Не удалось отправить отчет: ${error.message}.`);
        }
    } finally {
        saveButton.innerHTML = '<svg data-lucide="send" class="w-5 h-5 mr-2"></svg> Сохранить отчет';
        saveButton.disabled = false;
        lucide.createIcons();
        window.updateMyReportsView(); // Обновление списка отчетов (если загрузится)
        window.loadReports(window.isAdmin ? 'all' : 'my'); // Обновление данных
    }
}


// --- ИНИЦИАЛИЗАЦИЯ ДАШБОРДА (ОБНОВЛЕННАЯ ЛОГИКА) ---

window.loadDashboard = async function() {
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
        
        // Если пользователь Админ, по умолчанию показываем карту
        if (window.isAdmin && startSection === 'form-view') {
             startSection = 'map-view';
        }
        
        // Если Агитатор пришел на панель Админа, показываем форму/отчеты
        if (!window.isAdmin && (startSection === 'map-view' || startSection === 'stats' || startSection === 'raw-data')) {
             startSection = 'form-view';
        }

        // 5. [НОВОЕ] Добавляем прослушиватели событий для автоматической синхронизации
        window.addEventListener('online', syncOfflineReports);

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
}
