// main.js (УЛУЧШЕННАЯ ВЕРСИЯ С РЕДАКТИРОВАНИЕМ И АДМИН-ФУНКЦИЯМИ)

// --- Глобальные переменные ---
let currentLatitude = null; 
let currentLongitude = null;
let dadataCoords = null;    
let selectedSuggestionData = null; 
window.reportToEditId = null; // ID отчета для редактирования

const addressInput = document.getElementById('address');
const suggestionsList = document.getElementById('suggestionsList');

// ... (1. ИНТЕГРАЦИЯ DADATA - код остается прежним, но с window.DADATA_TOKEN) ...

// ----------------------------------------------------------------------
// 2. ГЕОЛОКАЦИЯ (ТОЛЬКО ПО НАЖАТИЮ)
// ----------------------------------------------------------------------

window.getCurrentLocation = function() {
    const geoStatus = document.getElementById('geoStatus');
    const geoIcon = document.getElementById('geoIcon');
    
    geoStatus.textContent = 'Геолокация: ⏳ Определение...';
    geoIcon.setAttribute('data-lucide', 'loader'); 
    lucide.createIcons();
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLatitude = position.coords.latitude;
                currentLongitude = position.coords.longitude;
                geoStatus.textContent = `Геолокация: ✅ Получено (${currentLatitude.toFixed(4)}, ${currentLongitude.toFixed(4)})`;
                geoIcon.setAttribute('data-lucide', 'check-circle'); 
                lucide.createIcons();
            },
            (error) => {
                console.error("Geolocation error:", error);
                geoStatus.textContent = 'Геолокация: ❌ Отказано в доступе или ошибка.';
                geoIcon.setAttribute('data-lucide', 'x-circle'); 
                currentLatitude = null;
                currentLongitude = null;
                lucide.createIcons();
                window.showAlert('Геолокация', 'Не удалось получить GPS-координаты. Проверьте разрешения.');
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    } else {
        geoStatus.textContent = 'Геолокация: ❌ Не поддерживается.';
        geoIcon.setAttribute('data-lucide', 'alert-triangle');
        lucide.createIcons();
        window.showAlert('Геолокация', 'Ваш браузер не поддерживает API геолокации.');
    }
}


// ----------------------------------------------------------------------
// 3. ЗАГРУЗКА ДАННЫХ ДЛЯ РЕДАКТИРОВАНИЯ
// ----------------------------------------------------------------------

window.loadReportForEdit = async function(reportId) {
    if (!window.db) {
        window.showAlert('Ошибка', 'Соединение с БД не установлено.');
        return;
    }
    
    // Сброс формы и статуса
    document.getElementById('reportForm').reset();
    window.reportToEditId = null;
    document.getElementById('saveButton').textContent = 'Сохранить Отчет';
    
    try {
        const docRef = window.db.collection("reports").doc(reportId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            window.showAlert('Ошибка', 'Отчет не найден.');
            return;
        }
        
        const data = doc.data();
        const currentTime = new Date();
        const reportTime = data.timestamp ? data.timestamp.toDate() : null;
        const diffMinutes = reportTime ? (currentTime.getTime() - reportTime.getTime()) / (1000 * 60) : Infinity;

        // 1. Проверка 30-минутного окна
        if (!window.isAdmin && diffMinutes > 30) {
            window.showAlert('Ошибка доступа', `Редактирование разрешено только в течение 30 минут. Прошло ${Math.ceil(diffMinutes)} мин.`);
            return;
        }
        
        // 2. Проверка владельца (для Агитатора)
        if (!window.isAdmin && data.telegramId !== window.userTelegramId) {
             window.showAlert('Ошибка доступа', 'Вы можете редактировать только свои отчеты.');
             return;
        }

        // Заполнение формы
        window.reportToEditId = reportId;
        document.getElementById('saveButton').textContent = 'Обновить Отчет (Редактирование)';
        
        document.getElementById('settlement').value = data.settlement || '';
        document.getElementById('address').value = data.address || '';
        document.getElementById('comment').value = data.comment || '';
        
        if (data.loyalty) document.querySelector(`input[name="loyalty"][value="${data.loyalty}"]`).checked = true;
        if (data.action) document.querySelector(`input[name="action"][value="${data.action}"]`).checked = true;
        
        // Восстановление Dadata/Geo-координат
        dadataCoords = { latitude: data.latitude, longitude: data.longitude };
        currentLatitude = data.geo_lat_user;
        currentLongitude = data.geo_lon_user;
        selectedSuggestionData = { value: data.address }; 
        
        // Обновление статуса геолокации
        document.getElementById('geoStatus').textContent = currentLatitude 
            ? `Геолокация: ✅ Получено (${currentLatitude.toFixed(4)}, ${currentLongitude.toFixed(4)})`
            : 'Геолокация: ❓ Не получена';
            
        window.showSection('form-view');
        window.showAlert('Редактирование', `Отчет ID: ${reportId} загружен для редактирования.`);
        
    } catch (e) {
        console.error("Error loading document for edit: ", e);
        window.showAlert('Ошибка загрузки', `Не удалось загрузить отчет: ${e.message}.`);
    }
}


// ----------------------------------------------------------------------
// 4. СОХРАНЕНИЕ/ОБНОВЛЕНИЕ ОТЧЕТА В FIRESTORE
// ----------------------------------------------------------------------

window.saveReport = async function() {
    if (!window.db) {
        window.showAlert('ОШИБКА FIRESTORE', 'Соединение с базой данных не установлено.');
        return;
    }
    
    // ... (ВАЛИДАЦИЯ - остается прежней) ...

    const form = document.getElementById('reportForm');
    const formData = new FormData(form);
    
    if (!selectedSuggestionData || addressInput.value !== selectedSuggestionData.value) {
        document.getElementById('addressError').textContent = '⚠️ Выберите адрес из списка Dadata!';
        document.getElementById('addressError').style.display = 'block';
        window.showAlert('Ошибка формы', 'Необходимо выбрать корректный адрес из списка подсказок.');
        return;
    }
    
    if (!dadataCoords || !dadataCoords.latitude || !dadataCoords.longitude) {
         window.showAlert('Ошибка формы', 'Выбранный адрес Dadata не содержит географических координат. Выберите другой адрес.');
         return;
    }
    
    if (!formData.get('loyalty') || !formData.get('action')) {
        window.showAlert('Ошибка формы', 'Поля "Лояльность" и "Действие" обязательны.');
        return;
    }

    const reportData = {
        telegramId: window.userTelegramId || 'unknown_user',
        settlement: formData.get('settlement'),
        address: selectedSuggestionData.value, 
        latitude: dadataCoords.latitude,
        longitude: dadataCoords.longitude,
        geo_lat_user: currentLatitude,
        geo_lon_user: currentLongitude,
        loyalty: formData.get('loyalty'),
        action: formData.get('action'),
        comment: formData.get('comment')
    };

    try {
        let successMessage;
        if (window.reportToEditId) {
            // РЕЖИМ РЕДАКТИРОВАНИЯ
            const docRef = window.db.collection("reports").doc(window.reportToEditId);
            // Используем .set() с merge: true, чтобы не перезаписывать timestamp создания
            await docRef.set(reportData, { merge: true }); 
            successMessage = 'Отчет успешно ОБНОВЛЕН в базе данных.';
        } else {
            // РЕЖИМ СОЗДАНИЯ
            reportData.timestamp = firebase.firestore.FieldValue.serverTimestamp();
            await window.db.collection("reports").add(reportData);
            successMessage = 'Новый отчет успешно СОХРАНЕН в базу данных.';
        }
        
        // Сброс формы и статусов
        form.reset();
        window.reportToEditId = null;
        document.getElementById('saveButton').textContent = 'Сохранить Отчет';
        currentLatitude = null;
        currentLongitude = null;
        selectedSuggestionData = null;
        dadataCoords = null;
        document.getElementById('geoStatus').textContent = 'Геолокация: ❓ Не получена';
        lucide.createIcons();
        
        window.showAlert('УСПЕХ', successMessage);
        
    } catch (e) {
        console.error("Error saving document: ", e);
        window.showAlert('КРИТИЧЕСКАЯ ОШИБКА', `Не удалось сохранить отчет: ${e.message}.`);
    }
}


// ----------------------------------------------------------------------
// 5. ЛОГИКА ЗАГРУЗКИ ДАШБОРДА (БЕЗ АВТО-GPS)
// ----------------------------------------------------------------------

window.loadDashboard = async function() {
    
    if (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp.ready) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
    }
    
    const saveButton = document.getElementById('saveButton');
    if (saveButton) saveButton.disabled = true;

    if (!window.initializeFirebase()) {
         window.showSection('form-view');
         return;
    }

    const isAuthenticated = await window.authenticateUser();
    
    // 2. Настройка UI по ролям
    if (isAuthenticated) {
         if (window.isAdmin) {
             document.getElementById('btn-map-view').classList.remove('hidden');
             document.getElementById('btn-stats').classList.remove('hidden');
             document.getElementById('btn-raw-data').classList.remove('hidden');
             document.getElementById('admin-upload-section').classList.remove('hidden');
             document.getElementById('btn-my-reports').classList.add('hidden'); // Админ не видит 'Мои Отчеты'
         } else {
             document.getElementById('btn-my-reports').classList.remove('hidden');
             document.getElementById('admin-upload-section').classList.add('hidden');
         }
         
         // 3. Выбор начального раздела
         const urlParams = new URLSearchParams(window.location.search);
         const initialView = urlParams.get('view') || 'form-view';
         
         let startSection = initialView;
         if (!window.isAdmin && (initialView === 'map-view' || initialView === 'stats' || initialView === 'raw-data')) {
             startSection = 'form-view'; 
         }
         
         window.showSection(startSection);
         if (saveButton) saveButton.disabled = false;
         
    } else {
         window.showSection('form-view');
         if (saveButton) saveButton.disabled = true;
    }
}
