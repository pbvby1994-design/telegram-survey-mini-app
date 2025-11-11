// main.js

import { initializeFirebase, authenticateUser, isAdmin, db } from './firebase-auth.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

let mapInstance = null; // Глобальная переменная для экземпляра карты

// ----------------------------------------------------------------------
// 1. ФУНКЦИИ КАРТЫ (Устранение ошибки Yandex is not a function)
// ----------------------------------------------------------------------

/**
 * Инициализирует карту и загружает данные отчетов.
 * Вызывается автоматически после загрузки API Яндекс Карт (см admin_dashboard.html).
 */
window.initMap = async function() {
    console.log("Яндекс API загружен. Инициализация карты...");

    if (!ymaps) {
        console.error("Яндекс API не определен, проверьте подключение скрипта.");
        return;
    }
    
    // Центр по умолчанию (например, Москва)
    mapInstance = new ymaps.Map("map-container", {
        center: [55.7558, 37.6173], 
        zoom: 10,
        controls: ['zoomControl', 'fullscreenControl']
    });

    if (isAdmin) {
        // Если пользователь — админ, загружаем данные отчетов
        await loadReportsToMap();
    } else {
        console.warn("Пользователь не администратор. Отчеты не загружаются.");
    }
};

/**
 * Загружает отчеты из Firestore и размещает их на карте.
 */
async function loadReportsToMap() {
    if (!db) {
        console.error("Firestore не инициализирован. Проблема аутентификации.");
        alert("Не удалось загрузить отчеты: нет доступа к базе данных.");
        return;
    }
    
    const reportsCollection = collection(db, "reports");
    const snapshot = await getDocs(reportsCollection);
    const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (reports.length === 0) {
        console.log("Отчетов не найдено.");
        return;
    }

    const objectManager = new ymaps.ObjectManager({
        clusterize: true, // Включаем кластеризацию
        gridSize: 32
    });
    
    const features = reports.filter(r => r.location && r.location.latitude && r.location.longitude).map(r => {
        // Форматирование данных для балуна (всплывающего окна)
        const date = r.timestamp ? new Date(r.timestamp.toDate()).toLocaleDateString('ru-RU') : 'N/A';
        const content = `
            <div>
                <strong>Отчет #${r.id}</strong><br>
                Дата: ${date}<br>
                Тема: ${r.topic || 'N/A'}<br>
                Результат: ${r.result || 'N/A'}
            </div>
        `;

        return {
            type: 'Feature',
            id: r.id,
            geometry: {
                type: 'Point',
                coordinates: [r.location.longitude, r.location.latitude] // Yandex Maps ожидает [долгота, широта]
            },
            properties: {
                balloonContent: content,
                hintContent: r.topic || 'Отчет'
            },
            options: {
                preset: 'islands#blueDotIcon'
            }
        };
    });

    objectManager.add(features);
    mapInstance.geoObjects.add(objectManager);
}

// ----------------------------------------------------------------------
// 2. ФУНКЦИЯ СМЕНЫ РОЛИ (Устранение нерабочей кнопки)
// ----------------------------------------------------------------------

/**
 * Перенаправляет пользователя обратно на экран выбора роли (index.html),
 * сохраняя все параметры URL (токен, конфиг и т.д.).
 */
window.changeRole = function() {
    // Получаем текущий путь (например, /telegram-survey-mini-app/admin_dashboard.html)
    let currentPath = window.location.pathname;
    
    // Заменяем admin_dashboard.html на index.html
    let targetPath = currentPath.replace('admin_dashboard.html', 'index.html');
    
    // Сохраняем все текущие параметры (token, firebase_config, user_id)
    const search = window.location.search;
    const hash = window.location.hash;

    // Перенаправляем
    window.location.href = `${window.location.origin}${targetPath}${search}${hash}`;
};

// ----------------------------------------------------------------------
// 3. ОБЩАЯ ИНИЦИАЛИЗАЦИЯ
// ----------------------------------------------------------------------

window.onload = async () => {
    // Выполняется после загрузки DOM, но до initMap (которая асинхронна)
    if (initializeFirebase()) {
        const isAuthenticated = await authenticateUser();
        
        if (!isAuthenticated) {
            alert("Ошибка доступа. Проверьте токен.");
            return;
        }

        // Обновляем UI после успешной авторизации
        const roleStatus = document.getElementById('role-status');
        if (roleStatus) {
            roleStatus.textContent = isAdmin ? 'Администратор' : 'Агитатор';
        }

        // Если вид - это форма, показываем форму. Если карта, ждем initMap.
        const view = new URLSearchParams(window.location.search).get('view');
        if (view === 'form') {
            // Здесь может быть код для активации формы агитатора
            console.log("Загружена форма для Агитатора.");
        }
        
    } else {
        alert("Критическая ошибка: Не удалось инициализировать Firebase.");
    }
};
