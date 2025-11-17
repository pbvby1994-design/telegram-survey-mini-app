// offline_db.js (УТИЛИТА ДЛЯ РАБОТЫ С IndexedDB)

const DB_NAME = 'ReportDB';
const DB_VERSION = 1;
const STORE_NAME = 'offlineReports';

let db = null;

/**
 * Инициализирует IndexedDB и создает хранилище, если оно не существует.
 * @returns {Promise<IDBDatabase>} Объект базы данных.
 */
function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                // Создаем хранилище. Ключ будет генерироваться автоматически.
                db.createObjectStore(STORE_NAME, { autoIncrement: true });
            }
        };
    });
}

/**
 * Сохраняет отчет в IndexedDB.
 * @param {Object} reportData Данные отчета.
 * @returns {Promise<number>} Ключ сохраненного отчета.
 */
window.saveOfflineReport = async function(reportData) {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Добавляем timestamp для последующей сортировки
        const dataToStore = { ...reportData, saved_at: new Date().getTime() };

        const request = store.add(dataToStore);

        request.onsuccess = (event) => {
            resolve(event.target.result); // Возвращает сгенерированный ключ
        };

        request.onerror = (event) => {
            console.error("Error saving offline report:", event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * Загружает все сохраненные оффлайн-отчеты.
 * @returns {Promise<Array<Object>>} Массив объектов { key, reportData }.
 */
window.getOfflineReports = async function() {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();

        const reports = [];

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                reports.push({ key: cursor.key, data: cursor.value });
                cursor.continue();
            } else {
                resolve(reports);
            }
        };

        request.onerror = (event) => {
            console.error("Error retrieving offline reports:", event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * Удаляет отчет из IndexedDB по ключу.
 * @param {number} key Ключ отчета, который нужно удалить.
 * @returns {Promise<void>}
 */
window.deleteOfflineReport = async function(key) {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = (event) => {
            console.error("Error deleting offline report:", event.target.error);
            reject(event.target.error);
        };
    });
}

// Запускаем инициализацию базы данных при загрузке скрипта
initDB().catch(e => console.error("Failed to initialize offline DB:", e));