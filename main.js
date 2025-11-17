// main.js (ИСПРАВЛЕННАЯ ФИНАЛЬНАЯ ВЕРСИЯ)

// --- Глобальные переменные ---
window.mapInstance = null; 
let dadataCoords = null;    

// --- КОНФИГУРАЦИЯ DADATA (ИЗМЕНЕНИЕ): Ключ берется из глобальной переменной ---
// УДАЛЕНА строка `const DADATA_API_KEY = window.DADATA_API_KEY;`
// Эта строка вызывала ошибку в синхронном блоке ниже, когда ключ еще не был установлен.
const urlParams = new URLSearchParams(window.location.search);
const DADATA_LOCATION_FIAS_ID = urlParams.get('dadata_fias_id') || '86'; 

let selectedSuggestionData = null; 

const addressInput = document.getElementById('address');
const suggestionsList = document.getElementById('suggestionsList');
const addressStatus = document.getElementById('addressStatus');
const saveButton = document.getElementById('saveButton');
const infoContainer = document.getElementById('offlineInfo');

// --- УТИЛИТА: debounce (для ограничения вызовов API) ---
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// --- DADATA API ---
async function fetchSuggestions(query) {
    // ВАЖНО: Читаем ключ Dadata прямо перед использованием
    const dadataKey = window.DADATA_API_KEY;

    if (!dadataKey) {
        console.error("DADATA_API_KEY не установлен. Поиск адресов Dadata недоступен.");
        if (addressStatus) {
            addressStatus.textContent = '⚠️ API Dadata недоступно. Обратитесь к администратору.';
        }
        return;
    }

    if (query.length < 3) {
        suggestionsList.innerHTML = '';
        return;
    }

    const apiUrl = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address";
    
    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            mode: "cors",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": "Token " + dadataKey
            },
            body: JSON.stringify({
                query: query,
                locations: [{ "region_fias_id": DADATA_LOCATION_FIAS_ID }], 
                count: 5
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        renderSuggestions(data.suggestions);

    } catch (error) {
        console.error("Dadata API error:", error);
        addressStatus.textContent = '❌ Ошибка Dadata API.';
        suggestionsList.innerHTML = '';
    }
}

function renderSuggestions(suggestions) {
    suggestionsList.innerHTML = '';
    
    suggestions.forEach(suggestion => {
        if (suggestion.data && suggestion.data.geo_lat && suggestion.data.geo_lon && suggestion.value) {
            const li = document.createElement('li');
            li.className = 'p-2 cursor-pointer hover:bg-indigo-100/50 transition-colors text-sm';
            li.textContent = suggestion.value;
            
            li.addEventListener('click', () => {
                addressInput.value = suggestion.value;
                selectedSuggestionData = {
                    address: suggestion.value,
                    latitude: parseFloat(suggestion.data.geo_lat),
                    longitude: parseFloat(suggestion.data.geo_lon),
                    fias_id: suggestion.data.fias_id
                };
                suggestionsList.innerHTML = ''; 
            });
            
            suggestionsList.appendChild(li);
        }
    });
}

function handleAddressInput(event) {
    selectedSuggestionData = null; 
    if (addressStatus) addressStatus.textContent = '';
    fetchSuggestions(event.target.value);
}

// ----------------------------------------------------------------------
// ОТПРАВКА ОТЧЕТА (Остается без изменений)
// ----------------------------------------------------------------------

async function submitReport() {
    // ... (код submitReport остается прежним)
    const reportData = getReportData();
    if (!reportData) {
        return; 
    }

    reportData.user_id = window.userTelegramId;
    reportData.username = window.userTelegramUsername || 'Не указано';
    reportData.saved_at = Date.now(); 

    if (navigator.onLine && window.db) {
        try {
            reportData.timestamp = window.firebase.firestore.FieldValue.serverTimestamp();
            delete reportData.saved_at; 
            
            const docRef = await window.db.collection('reports').add(reportData);
            window.showAlert('ОТЧЕТ ОТПРАВЛЕН', `✅ Отчет успешно сохранен в облаке. ID: ${docRef.id}`);
            resetForm();
        } catch (error) {
            console.error("Firebase save failed, saving offline:", error);
            window.showAlert('ОШИБКА СЕТИ', `⚠️ Не удалось отправить отчет. ${error.message}. Сохранено оффлайн.`);
            await window.saveOfflineReport(reportData);
            window.updateOfflineIndicator();
        }
    } else {
        window.showAlert('ОФФЛАЙН РЕЖИМ', '💾 Отчет сохранен локально. Синхронизируется при появлении сети.');
        await window.saveOfflineReport(reportData);
        window.updateOfflineIndicator();
    }
}

function getReportData() {
    const data = {
        settlement: document.getElementById('settlement').value,
        loyalty: document.querySelector('input[name="loyalty"]:checked')?.value,
        action: document.getElementById('action').value,
        comment: document.getElementById('comment').value
    };
    
    if (selectedSuggestionData) {
        data.address = selectedSuggestionData.address;
        data.latitude = selectedSuggestionData.latitude;
        data.longitude = selectedSuggestionData.longitude;
        data.fias_id = selectedSuggestionData.fias_id;
    } else if (addressInput.value) {
        data.address = addressInput.value;
    }
    
    if (!data.settlement || !data.loyalty) {
        window.showAlert('Ошибка', 'Пожалуйста, выберите населенный пункт и лояльность.');
        return null;
    }
    
    if (addressInput.value && !selectedSuggestionData) {
        const confirm = window.confirm('Вы ввели адрес вручную и не выбрали его из списка Dadata. В отчете не будет точных координат. Продолжить?');
        if (!confirm) return null;
    }

    return data;
}

function resetForm() {
    document.getElementById('settlement').selectedIndex = 0;
    addressInput.value = '';
    selectedSuggestionData = null;
    document.getElementById('action').selectedIndex = 0;
    document.getElementById('comment').value = '';
    document.querySelectorAll('input[name="loyalty"]').forEach(radio => radio.checked = false);
}

// ----------------------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ
// ----------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Создаем иконки
    lucide.createIcons();
    
    // 2. Инициализация Firebase и аутентификация
    const authSuccess = window.initializeFirebase ? window.initializeFirebase() : false;
    if (authSuccess) {
        
        // 3. Проверка оффлайн-отчетов
        window.updateOfflineIndicator();
        
        // 4. Синхронизация при старте, если есть сеть
        if (navigator.onLine) {
            // ИСПРАВЛЕНИЕ: Заменяем несуществующую иконку cloud-sync на cloud
            const syncIcon = document.querySelector('[data-lucide="cloud-sync"]');
            if (syncIcon) syncIcon.setAttribute('data-lucide', 'cloud'); 

            await window.syncOfflineReports();
        }
        
    } else {
        if (saveButton) saveButton.disabled = true;
    }
    
    // 5. Назначаем обработчики событий
    if (saveButton) {
        saveButton.addEventListener('click', (e) => {
            e.preventDefault();
            submitReport();
        });
    }

    const geolocationButton = document.getElementById('geolocationButton');
    if (geolocationButton) {
        geolocationButton.addEventListener('click', (e) => {
            e.preventDefault();
            requestGeolocation();
        });
    }
    
    const syncButton = document.getElementById('syncButton');
    if (syncButton) {
        syncButton.addEventListener('click', (e) => {
            e.preventDefault();
            window.syncOfflineReports();
        });
    }

    // Обработчик для Dadata 
    if (addressInput) {
        // Убрали синхронную проверку DADATA_API_KEY, оставили только логику
        addressInput.addEventListener('input', debounce(handleAddressInput, 300));
        addressInput.addEventListener('focus', handleAddressInput); 
    }
    
    // PWA: Регистрация Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            // ИСПОЛЬЗУЕМ ОТНОСИТЕЛЬНЫЙ ПУТЬ `./sw.js` для совместимости с GitHub Pages
            navigator.serviceWorker.register('./sw.js', { scope: './' }) 
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(error => {
                    console.error('ServiceWorker registration failed: ', error);
                });
        });
    }

});
