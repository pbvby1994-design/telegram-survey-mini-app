// main.js (ВЕРСИЯ С ПОЛНЫМ ПАРСИНГОМ DADATA)

// --- Глобальные переменные ---
window.mapInstance = null; 
let currentLatitude = null; 
let currentLongitude = null;
let dadataCoords = null;    

// --- КОНФИГУРАЦИЯ DADATA ---
// ВАЖНО: Установите ваш публичный токен DADATA
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
    // Сбрасываем данные при новом вводе
    selectedSuggestionData = null; 
    document.getElementById('addressError').style.display = 'none';

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

                    // 2. --- АВТОМАТИЧЕСКИЙ ПАРСИНГ ВСЕХ КОМПОНЕНТОВ АДРЕСА ---
                    const data = selectedSuggestionData;
                    
                    // Регион, Район, Город/Поселок
                    if (document.getElementById('region_field')) {
                        document.getElementById('region_field').value = data.region_with_type || data.region || '';
                    }
                    if (document.getElementById('area_field')) {
                        document.getElementById('area_field').value = data.area_with_type || data.area || '';
                    }
                    if (document.getElementById('city_settlement_field')) {
                        // Используем Город (city) или Поселение (settlement)
                        document.getElementById('city_settlement_field').value = data.city_with_type || data.settlement_with_type || data.city || data.settlement || '';
                    }
                    
                    // Улица, Дом, Квартира
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
        suggestionsList.classList.add('hidden');
    }
});

// Скрытие списка подсказок при клике вне его
document.addEventListener('click', (event) => {
    if (event.target !== addressInput && !suggestionsList.contains(event.target)) {
        suggestionsList.classList.add('hidden');
    }
});

// ----------------------------------------------------------------------
// 2. ОТПРАВКА ДАННЫХ В FIREBASE (Обновлена для новых полей)
// ----------------------------------------------------------------------

document.getElementById('reportForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Валидация Dadata (проверка, что адрес выбран из списка)
    if (!selectedSuggestionData || selectedSuggestionData.value !== addressInput.value.trim()) {
        if (addressInput.value.trim().length > 0) {
            document.getElementById('addressError').style.display = 'block';
            showAlert('Ошибка ввода', 'Пожалуйста, выберите адрес из выпадающего списка Dadata.');
            return;
        }
    }

    document.getElementById('saveButton').disabled = true;
    document.getElementById('saveButtonText').textContent = 'Сохранение...';

    const form = e.target;
    const data = new FormData(form);
    
    // Проверка наличия геоданных для карты (опционально)
    if (!dadataCoords || !dadataCoords.lat) {
         console.warn("Отчет отправляется без геоданных.");
    }

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
        region: data.get('region_field'),             // Регион
        area: data.get('area_field'),                 // Район
        city_settlement: data.get('city_settlement_field'), // Город/Поселок
        street: data.get('street_field'),             // Улица
        house: data.get('house_field'),               // Дом
        flat: data.get('flat_field'),                 // Квартира

        // Геоданные
        latitude: dadataCoords ? dadataCoords.lat : null,
        longitude: dadataCoords ? dadataCoords.lon : null
    };

    try {
        if (!window.db) throw new Error("Firestore не инициализирован.");
        
        // Отправка в коллекцию 'reports'
        await window.db.collection('reports').add(report);
        
        // Уведомление Telegram
        if (window.Telegram.WebApp) {
             window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
             window.Telegram.WebApp.close(); // Закрываем приложение
        }

        // Сброс формы и уведомление
        form.reset();
        selectedSuggestionData = null; 
        dadataCoords = null; 
        addressInput.value = ''; 
        showAlert('Успех', 'Отчет успешно сохранен! (Приложение будет закрыто)');

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
    }
    
    document.getElementById('saveButton').disabled = true;

    if (!window.initializeFirebase()) {
         window.showSection('form');
         return;
    }

    const isAuthenticated = await window.authenticateUser();
    
    if (isAuthenticated) {
         // Отображение статуса
         document.getElementById('debugUserId').textContent = window.userTelegramId;

         if (window.isAdmin) {
             document.getElementById('btn-map-view').classList.remove('hidden');
             document.getElementById('btn-report-view').classList.remove('hidden');
         }
         
         const urlParams = new URLSearchParams(window.location.search);
         const initialView = urlParams.get('view');
         
         let startSection = 'form';
         if (window.isAdmin && (initialView === 'map' || initialView === 'map-view')) {
             startSection = 'map-view';
         } else if (window.isAdmin && initialView === 'report-view') {
             startSection = 'report-view';
         }
         
         window.showSection(startSection);
         document.getElementById('saveButton').disabled = false;
         
    } else {
         window.showSection('form');
         document.getElementById('saveButton').disabled = true;
    }
};
