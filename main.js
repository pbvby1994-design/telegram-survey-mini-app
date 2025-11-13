// main.js (ОБНОВЛЕННАЯ ВЕРСИЯ с исправлениями ошибок)

// --- Глобальные переменные ---
window.mapInstance = null; 
let currentLatitude = null; 
let currentLongitude = null;
let dadataCoords = null;    

// --- КОНФИГУРАЦИЯ DADATA ---
const DADATA_API_KEY = '29c85666d57139f459e452d1290dd73c23708472'; 
let selectedSuggestionData = null; 

const addressInput = document.getElementById('address');
const suggestionsList = document.getElementById('suggestionsList');

/**
 * Ручной обработчик ввода для Dadata
 */
if (addressInput) {
    addressInput.addEventListener('input', async () => {
        const query = addressInput.value.trim();
        if (query.length < 3) {
            suggestionsList.innerHTML = '';
            suggestionsList.classList.add('hidden');
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
                    locations: [
                        { region_fias_id: "270529d3-d4d1-420a-8106-930b80693a8e" } // Сургутский район
                    ]
                })
            });

            const json = await response.json();
            suggestionsList.innerHTML = '';
            suggestionsList.classList.remove('hidden');

            if (json.suggestions && json.suggestions.length > 0) {
                json.suggestions.forEach(suggestion => {
                    const li = document.createElement('li');
                    li.textContent = suggestion.value;
                    li.className = 'p-2 cursor-pointer hover:bg-indigo-100 transition-colors duration-150 text-gray-800';
                    li.onclick = () => {
                        addressInput.value = suggestion.value;
                        selectedSuggestionData = suggestion.data;
                        suggestionsList.classList.add('hidden');
                        document.getElementById('addressError').style.display = 'none';
                        
                        // Сохранение координат Dadata
                        dadataCoords = { 
                            lat: selectedSuggestionData.geo_lat ? parseFloat(selectedSuggestionData.geo_lat) : null, 
                            lon: selectedSuggestionData.geo_lon ? parseFloat(selectedSuggestionData.geo_lon) : null
                        };
                    };
                    suggestionsList.appendChild(li);
                });
            } else {
                const li = document.createElement('li');
                li.textContent = 'Адреса не найдены';
                li.className = 'p-2 text-gray-500 italic';
                suggestionsList.appendChild(li);
            }

        } catch (error) {
            console.error("Dadata error:", error);
            suggestionsList.innerHTML = `<li class="p-2 text-red-500">Ошибка: ${error.message}</li>`;
        }
    });

    // Скрытие списка при клике вне
    document.addEventListener('click', (event) => {
        if (!addressInput.contains(event.target) && !suggestionsList.contains(event.target)) {
            suggestionsList.classList.add('hidden');
        }
    });
}


// ----------------------------------------------------------------------
// 2. ГЕОЛОКАЦИЯ
// ----------------------------------------------------------------------

window.getCurrentLocation = function() {
    if ('geolocation' in navigator) {
        document.getElementById('geoStatus').textContent = '🛰️ Поиск...';
        document.getElementById('geoIcon').classList.add('animate-spin');
        
        navigator.geolocation.getCurrentPosition((position) => {
            currentLatitude = position.coords.latitude;
            currentLongitude = position.coords.longitude;
            document.getElementById('geoStatus').textContent = `✅ GPS: ${currentLatitude.toFixed(4)}, ${currentLongitude.toFixed(4)}`;
            document.getElementById('geoIcon').classList.remove('animate-spin');
        }, (error) => {
            console.error("Geolocation error:", error);
            document.getElementById('geoStatus').textContent = '❌ Ошибка GPS: ' + error.message;
            document.getElementById('geoIcon').classList.remove('animate-spin');
            window.showAlert('Ошибка Геолокации', 'Не удалось получить GPS-координаты. Проверьте разрешения браузера.');
            currentLatitude = null;
            currentLongitude = null;
        }, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        });
    } else {
        window.showAlert('Ошибка', 'Геолокация не поддерживается вашим устройством/браузером.');
    }
}

// ----------------------------------------------------------------------
// 3. СОХРАНЕНИЕ ОТЧЕТА
// ----------------------------------------------------------------------

window.saveReport = async function(docId = null) {
    // 1. Сбор данных
    const form = document.getElementById('reportForm');
    const formData = new FormData(form);
    
    // Проверка выбора Dadata
    if (!selectedSuggestionData && dadataCoords === null) {
         document.getElementById('addressError').style.display = 'block';
         window.showAlert('Ошибка данных', 'Пожалуйста, выберите адрес из выпадающего списка Dadata.');
         return;
    }

    const reportData = {
        settlement: formData.get('settlement'),
        address: formData.get('address'),
        loyalty: formData.get('loyalty'),
        action: formData.get('action'),
        comment: formData.get('comment') || '',
        // Координаты: GPS (если есть), иначе Dadata
        latitude: currentLatitude || dadataCoords?.lat || null,
        longitude: currentLongitude || dadataCoords?.lon || null,
        user_id: window.userTelegramId,
        username: window.userTelegramUsername || 'anonymous',
        timestamp: firebase.firestore.FieldValue.serverTimestamp() // Firestore Timestamp
    };

    try {
        if (!window.db) {
            throw new Error("Firestore is not initialized.");
        }
        
        // 2. Сохранение в Firestore
        if (docId) {
             // Редактирование существующего
             await window.db.collection("reports").doc(docId).update(reportData);
             window.showAlert('Успешно', 'Отчет успешно обновлен!');
             // При редактировании переключаемся на "Мои Отчеты"
             window.showSection('my-reports-view'); 

        } else {
             // Новый отчет
             await window.db.collection("reports").add(reportData);
             window.showAlert('Успешно', 'Отчет успешно сохранен!');
             // При сохранении нового отчета переключаемся на "Мои Отчеты"
             window.showSection('my-reports-view');
        }

        // 3. Очистка формы (кроме НП)
        form.reset();
        document.getElementById('settlement').value = reportData.settlement;
        document.getElementById('geoStatus').textContent = 'Геолокация: ❓ Не получена';
        selectedSuggestionData = null;
        currentLatitude = null;
        currentLongitude = null;
        dadataCoords = null;
        document.getElementById('addressError').style.display = 'none';

    } catch (error) {
        console.error("Error saving report:", error);
        window.showAlert('Ошибка сохранения', `Не удалось сохранить отчет: ${error.message}`);
    }
}

// ----------------------------------------------------------------------
// 4. ИНИЦИАЛИЗАЦИЯ КАРТЫ (ИСПРАВЛЕНИЕ: ПЕРЕНЕСЕНО СЮДА ИЗ reports.js)
// ----------------------------------------------------------------------

window.initMap = function() {
    console.log("Yandex Map API: initMap called.");
    
    if (window.mapInstance) return; // Карта уже инициализирована
    if (typeof ymaps === 'undefined') {
         // Может произойти, если API загрузился, но ymaps еще не определен
         console.warn("ymaps is not defined yet."); 
         return; 
    }

    // Инициализация карты
    window.mapInstance = new ymaps.Map("mapContainer", {
        center: [60.7259, 73.1345], // Центр Сургутского района
        zoom: 8,
        controls: ['zoomControl', 'fullscreenControl']
    });

    // После инициализации карты, сразу загружаем данные, если мы админ и находимся на вкладке карты
    const currentSection = document.querySelector('.content-section:not(.hidden)')?.id;
    if (window.isAdmin && (currentSection === 'map-view' || currentSection === 'raw-data' || currentSection === 'stats') && typeof window.fetchReports === 'function') {
        window.fetchReports(document.getElementById('settlementFilter')?.value || null);
    }
}

// ----------------------------------------------------------------------
// 5. ЛОГИКА ЗАГРУЗКИ ДАШБОРДА (ИСПРАВЛЕНИЕ: Безопасный доступ к DOM)
// ----------------------------------------------------------------------

window.loadDashboard = async function() {
    // ⚠️ ИСПРАВЛЕНИЕ ОШИБКИ: Безопасный доступ к DOM (Null Error Fix)
    document.getElementById('mapLoading')?.classList.add('hidden'); 
    
    document.getElementById('saveButton').disabled = true;

    if (typeof initializeFirebase === 'undefined' || typeof authenticateUser === 'undefined') {
         window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', 'Проверьте подключение Firebase в HTML. Скрипты не найдены.');
         return;
    }
    
    if (!window.initializeFirebase()) {
         return;
    }

    const isAuthenticated = await window.authenticateUser();
    
    if (isAuthenticated) {
        
        // 1. Проверка роли
        const isAgitator = !window.isAdmin;
        
        // 2. Определение начального вида
        const urlParams = new URLSearchParams(window.location.search);
        const urlRole = urlParams.get('role'); // Роль, которую выбрал пользователь на index.html
        const initialView = urlParams.get('view') || 'form-view'; 

        // 3. Обновление статуса
        document.getElementById('debugAdminStatus').textContent = window.isAdmin ? 'ДА (Админ)' : 'НЕТ (Агитатор)';
        
        // 4. Управление видимостью кнопок
        if (window.isAdmin) {
            document.getElementById('btn-map-view')?.classList.remove('hidden');
            document.getElementById('btn-stats')?.classList.remove('hidden');
            document.getElementById('btn-raw-data')?.classList.remove('hidden');
            document.getElementById('btn-my-reports-view')?.classList.add('hidden');
        } else {
            // Агитатор видит только Форму и Мои Отчеты
            document.getElementById('btn-map-view')?.classList.add('hidden');
            document.getElementById('btn-stats')?.classList.add('hidden');
            document.getElementById('btn-raw-data')?.classList.add('hidden');
            document.getElementById('btn-my-reports-view')?.classList.remove('hidden');
        }

        // 5. Выбор начального раздела
        let startSection = initialView;
        
        // Если пользователь выбрал роль Администратора, убедимся, что он видит карту (по умолчанию)
        if (urlRole === 'admin' && startSection === 'form-view') {
             startSection = 'map-view';
        }

        // 6. Отображение
        window.showSection(startSection);
        document.getElementById('saveButton').disabled = false;
        
    } else {
         // Не удалось аутентифицировать или получить токен
         window.showSection('form-view');
         document.getElementById('saveButton').disabled = true;
         window.showAlert('Доступ ограничен', 'Не удалось пройти аутентификацию. Используйте ссылку из Telegram-бота.');
    }
}
