// main.js (ВЕРСИЯ С DADATA FETCH API И ПАРСИНГОМ)

// --- Глобальные переменные ---
window.mapInstance = null; 
let currentLatitude = null; 
let currentLongitude = null;
let dadataCoords = null;    

// --- КОНФИГУРАЦИЯ DADATA ---
// ИСПОЛЬЗУЙТЕ СВОЙ DADATA_TOKEN ИЗ .env
const DADATA_API_KEY = '29c85666d57139f459e452d1290dd73c23708472'; 
let selectedSuggestionData = null; 

// ----------------------------------------------------------------------
// 1. ИНТЕГРАЦИЯ DADATA (Fetch API)
// ----------------------------------------------------------------------

const addressInput = document.getElementById('address');
const suggestionsList = document.getElementById('suggestionsList');

/**
 * Ручной обработчик ввода для Dadata
 */
addressInput.addEventListener('input', async () => {
    const query = addressInput.value.trim();
    if (query.length < 3) {
        suggestionsList.innerHTML = '';
        suggestionsList.classList.add('hidden');
        return;
    }

    try {
        const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Token ${DADATA_API_KEY}`
            },
            body: JSON.stringify({
                query: query,
                // Дополнительный фильтр по населенному пункту, если выбран
                // locations: [{ city: document.getElementById('settlement').value || '*' }],
                count: 5 // Ограничим до 5 подсказок
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        suggestionsList.innerHTML = '';

        if (data.suggestions && data.suggestions.length > 0) {
            data.suggestions.forEach(suggestion => {
                const li = document.createElement('li');
                li.className = 'suggestion-item p-3 border-b border-gray-100 cursor-pointer text-sm hover:bg-indigo-50 transition';
                li.textContent = suggestion.value;

                li.onclick = () => {
                    // 1. Сохраняем полное значение и данные
                    addressInput.value = suggestion.value;
                    selectedSuggestionData = suggestion.data;
                    suggestionsList.classList.add('hidden');
                    document.getElementById('addressError').style.display = 'none';

                    // 2. --- АВТОМАТИЧЕСКИЙ ПАРСИНГ АДРЕСА ---
                    const data = selectedSuggestionData;
                    
                    // Заполнение скрытых полей (если они существуют в HTML)
                    // Используем оператор || для fallback на пустую строку, если компонент отсутствует
                    if (document.getElementById('street_field')) {
                        document.getElementById('street_field').value = data.street_with_type || data.street || '';
                    }
                    if (document.getElementById('house_field')) {
                        document.getElementById('house_field').value = data.house || '';
                    }
                    if (document.getElementById('flat_field')) {
                        document.getElementById('flat_field').value = data.flat || '';
                    }
                    
                    // 3. Сохранение координат Dadata
                    dadataCoords = { 
                        lat: data.geo_lat ? parseFloat(data.geo_lat) : null, 
                        lon: data.geo_lon ? parseFloat(data.geo_lon) : null
                    };
                };

                suggestionsList.appendChild(li);
            });
            suggestionsList.classList.remove('hidden');
        } else {
            suggestionsList.classList.add('hidden');
        }
    } catch (error) {
        console.error('Dadata Fetch Error:', error);
        // Не показываем ошибку пользователю, просто скрываем подсказки
        suggestionsList.classList.add('hidden');
    }
});

// Скрытие списка подсказок при клике вне его
document.addEventListener('click', (event) => {
    if (event.target !== addressInput && !suggestionsList.contains(event.target)) {
        suggestionsList.classList.add('hidden');
    }
});

/**
 * Валидация: Проверка, что адрес выбран из подсказки
 */
document.getElementById('reportForm').addEventListener('submit', function(event) {
    // Проверка, что выбранный адрес соответствует подсказке Dadata
    // Если selectedSuggestionData не установлен (т.е. адрес введен вручную и не выбран из списка)
    if (!selectedSuggestionData || selectedSuggestionData.value !== addressInput.value.trim()) {
        if (addressInput.value.trim().length > 0) {
            // Если что-то введено, но не выбрано
            document.getElementById('addressError').style.display = 'block';
            event.preventDefault();
            showAlert('Ошибка ввода', 'Пожалуйста, выберите адрес из выпадающего списка Dadata.');
        } else {
            // Если поле пустое (запрещено required в HTML)
            document.getElementById('addressError').style.display = 'none';
        }
    } else {
        document.getElementById('addressError').style.display = 'none';
    }
});


// ----------------------------------------------------------------------
// 2. ОТПРАВКА ДАННЫХ В FIREBASE
// ----------------------------------------------------------------------

document.getElementById('reportForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Блокируем кнопку
    document.getElementById('saveButton').disabled = true;
    document.getElementById('saveButtonText').textContent = 'Сохранение...';

    const form = e.target;
    const data = new FormData(form);
    const report = {
        telegram_id: window.userTelegramId,
        timestamp: new Date(),
        
        // Основные поля
        settlement: data.get('settlement'),
        address: data.get('address'),
        comment: data.get('comment'),
        loyalty: data.get('loyalty'),
        action: data.get('action'),
        
        // Добавленные структурированные поля Dadata
        street: data.get('street_field'), // Улица
        house: data.get('house_field'),   // Дом
        flat: data.get('flat_field'),     // Квартира

        // Геоданные
        latitude: dadataCoords ? dadataCoords.lat : null,
        longitude: dadataCoords ? dadataCoords.lon : null
    };

    try {
        if (!window.db) throw new Error("Firestore не инициализирован.");
        
        // Отправка в коллекцию 'reports'
        await window.db.collection('reports').add(report);
        
        // 1. Уведомление Telegram
        if (window.Telegram.WebApp) {
             window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
             window.Telegram.WebApp.close(); // Закрываем приложение
        }

        // 2. Сброс формы и уведомление
        form.reset();
        selectedSuggestionData = null; // Сброс данных Dadata
        addressInput.value = ''; // Очистка поля адреса
        showAlert('Успех', 'Отчет успешно сохранен!');

    } catch (error) {
        console.error("Ошибка при сохранении в Firestore: ", error);
        showAlert('Ошибка', `Не удалось сохранить отчет: ${error.message}`);
    } finally {
        // Разблокируем кнопку
        document.getElementById('saveButton').disabled = false;
        document.getElementById('saveButtonText').textContent = 'Сохранить Отчет';
    }
});

// ----------------------------------------------------------------------
// 3. ИНИЦИАЛИЗАЦИЯ ДАШБОРДА
// ----------------------------------------------------------------------

window.loadDashboard = async function() {
    // Включаем иконки
    lucide.createIcons();
    
    // Заполняем список населенных пунктов
    const settlementSelect = document.getElementById('settlement');
    // Используем SETTLEMENTS из reports.js
    if (window.SETTLEMENTS && settlementSelect) {
        window.SETTLEMENTS.forEach(settlement => {
            const option = document.createElement('option');
            option.value = settlement;
            option.textContent = settlement;
            settlementSelect.appendChild(option);
        });
    }

    // Проверка Telegram WebApp и инициализация
    if (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        // window.Telegram.WebApp.setHeaderColor('bg_color'); // Используем цвет фона
        // window.Telegram.WebApp.setBackgroundColor('#f4f6f9');
    }
    
    document.getElementById('saveButton').disabled = true;

    if (typeof initializeFirebase === 'undefined' || typeof authenticateUser === 'undefined') {
         window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Проверьте подключение Firebase в HTML. Скрипты не найдены.');
         window.showSection('form');
         return;
    }
    
    if (!initializeFirebase()) {
         window.showSection('form');
         return;
    }

    const isAuthenticated = await authenticateUser();
    
    if (isAuthenticated) {
         // Отображение статуса
         document.getElementById('debugUserId').textContent = window.userTelegramId;

         if (window.isAdmin) {
             document.getElementById('btn-map-view').style.display = 'inline-block';
             document.getElementById('btn-report-view').style.display = 'inline-block';
         }
         
         const urlParams = new URLSearchParams(window.location.search);
         const initialView = urlParams.get('view');
         
         let startSection = 'form';
         // Администратор по умолчанию видит карту
         if (window.isAdmin && (initialView === 'map' || initialView === 'map-view')) {
             startSection = 'map-view';
         } else if (window.isAdmin && initialView === 'report-view') {
             startSection = 'report-view';
         }
         
         window.showSection(startSection);
         document.getElementById('saveButton').disabled = false;
         
         // Инициализация карты, если это админ и начальная секция - карта
         if (startSection === 'map-view' && window.isAdmin && typeof window.initMap === 'function') {
             // initMap будет вызвана в showSection, если она еще не инициализирована
         }
         
    } else {
         window.showSection('form');
         document.getElementById('saveButton').disabled = true;
    }
};

// Запуск дашборда при загрузке документа (перенесено в admin_dashboard.html)
// document.addEventListener('DOMContentLoaded', window.loadDashboard);
