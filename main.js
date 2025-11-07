// main.js

// Импортируем из других модулей
import { initializeFirebase, authenticateUser, userTelegramId, isAdmin, db, collection, addDoc, Timestamp } from './firebase-auth.js';
import { fetchAndRenderReports, generateMap, filterAndRenderReports, exportReportsToCSV, SETTLEMENTS } from './reports.js'; 

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И КОНСТАНТЫ ---
let currentLatitude = null;
let currentLongitude = null; 

// ----------------------------------------------------------------------------------
// ФУНКЦИИ ИНТЕРФЕЙСА (Modal, Tabs, Selects)
// ----------------------------------------------------------------------------------

function populateSettlements() {
    const select = document.getElementById('settlement');
    select.innerHTML = '<option value="" disabled selected>Выберите населенный пункт</option>';
    SETTLEMENTS.forEach(settlement => {
        const option = document.createElement('option');
        option.value = settlement;
        option.textContent = settlement;
        select.appendChild(option);
    });
}

function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(sectionId).classList.remove('hidden');

    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active', 'text-indigo-600');
    });
    const sectionButton = document.getElementById(`btn-${sectionId}`);
    if (sectionButton) {
        sectionButton.classList.add('active');
    }
}

function showAlert(title, message) {
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertMessage').textContent = message;
    
    document.getElementById('alertModal').classList.remove('hidden');
    document.getElementById('alertModal').classList.add('flex');
}

function closeAlert() {
    document.getElementById('alertModal').classList.add('hidden');
    document.getElementById('alertModal').classList.remove('flex');
}

// ----------------------------------------------------------------------------------
// ФУНКЦИИ ГЕОЛОКАЦИИ И ФОРМЫ
// ----------------------------------------------------------------------------------

// Геолокация теперь вызывается ТОЛЬКО по клику на кнопку
function getGeolocation() {
    const geoStatus = document.getElementById('geoStatus');
    geoStatus.textContent = 'Определение...';
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLatitude = position.coords.latitude; 
                currentLongitude = position.coords.longitude;
                document.getElementById('geolocation').value = `${currentLatitude.toFixed(6)}, ${currentLongitude.toFixed(6)}`;
                geoStatus.textContent = 'Успешно!';
                geoStatus.classList.remove('text-gray-500');
                geoStatus.classList.add('text-green-600');
            },
            (error) => {
                currentLatitude = null;
                currentLongitude = null;
                document.getElementById('geolocation').value = 'Нет данных';
                geoStatus.textContent = 'Ошибка доступа';
                geoStatus.classList.remove('text-gray-500', 'text-green-600');
                geoStatus.classList.add('text-red-500');
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    } else {
        geoStatus.textContent = 'Не поддерживается';
        showAlert('Ошибка', 'Геолокация не поддерживается вашим устройством/браузером.');
    }
}

async function saveSurveyData(event) {
    event.preventDefault();
    const saveStatus = document.getElementById('saveStatus');
    document.getElementById('saveButton').disabled = true;
    saveStatus.textContent = '⏳ Отправка...';

    if (!db || !userTelegramId) {
        showAlert('Ошибка', 'Приложение не подключено к базе данных или пользователь не авторизован.');
        document.getElementById('saveButton').disabled = false;
        saveStatus.textContent = 'Ошибка';
        return;
    }
    
    const comment = document.getElementById('comment').value || "";
    
    if (comment.length > 500) {
        showAlert('Ошибка', 'Комментарий слишком длинный (максимум 500 символов).');
        document.getElementById('saveButton').disabled = false;
        saveStatus.textContent = 'Готов';
        return;
    }
    
    const data = {
        reporterId: userTelegramId, 
        timestamp: Timestamp.fromDate(new Date()), 
        
        settlement: document.getElementById('settlement').value,
        address: document.getElementById('address').value,
        action: document.getElementById('action').value, 
        loyalty: document.getElementById('loyalty').value,
        comment: comment,
        photo: null, 
        latitude: currentLatitude, 
        longitude: currentLongitude
    };
    
    try {
        await addDoc(collection(db, "reports"), data);
        showAlert('Успех', 'Данные успешно сохранены!');
        document.getElementById('surveyForm').reset();
        saveStatus.textContent = '✅ Успешно!';
        
        // Сброс геоданных
        currentLatitude = null;
        currentLongitude = null;
        document.getElementById('geolocation').value = '';
        document.getElementById('geoStatus').textContent = '(Нажмите кнопку ниже, если нужно)';
        document.getElementById('geoStatus').classList.remove('text-green-600', 'text-red-500');
        document.getElementById('geoStatus').classList.add('text-gray-500');

        setTimeout(() => saveStatus.textContent = 'Готов', 3000);
    } catch (e) {
        console.error("Error adding document: ", e);
        showAlert('Ошибка', `Не удалось сохранить данные: ${e.message}. Проверьте правила Firestore.`);
        saveStatus.textContent = 'Ошибка';
    } finally {
        document.getElementById('saveButton').disabled = false;
    }
}

// ----------------------------------------------------------------------------------
// ГЛАВНЫЙ БЛОК ЗАПУСКА (window.onload)
// ----------------------------------------------------------------------------------

window.onload = async () => {
    // 0. Назначаем глобальные функции, чтобы они работали из HTML (onclick)
    window.showAlert = showAlert;
    window.closeAlert = closeAlert;
    window.showSection = showSection;
    window.getGeolocation = getGeolocation;
    window.saveSurveyData = saveSurveyData;
    
    // Экспортированные функции из reports.js
    window.fetchAndRenderReports = fetchAndRenderReports;
    window.generateMap = generateMap;
    window.filterAndRenderReports = filterAndRenderReports;
    window.exportReportsToCSV = exportReportsToCSV; 


    populateSettlements();
    lucide.createIcons();
    
    // 1. Инициализация Firebase и получение токена
    const initialAuthToken = initializeFirebase();
    
    // 2. Аутентификация
    const isAuthenticated = await authenticateUser(initialAuthToken);
    
    // 3. Управление видимостью админ-панели и начальной секцией
    
    if (isAuthenticated) {
        // Управление видимостью табов
        const reportBtn = document.getElementById('btn-reports');
        const mapBtn = document.getElementById('btn-map-view');
        
        if (!isAdmin) {
             // Скрываем табы отчетов и карты для обычных пользователей
            if (reportBtn) reportBtn.style.display = 'none';
            if (mapBtn) mapBtn.style.display = 'none';
            showSection('form');
        } else {
            // Если админ, показываем все табы и переходим в Отчеты
            if (reportBtn) reportBtn.style.display = '';
            if (mapBtn) mapBtn.style.display = '';
            showSection('reports');
            fetchAndRenderReports(); 
        }
    } else {
         // Если аутентификация не удалась, показываем форму и блокируем сохранение
         showSection('form');
         document.getElementById('saveButton').disabled = true;
    }
};
