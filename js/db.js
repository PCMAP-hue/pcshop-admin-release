/**
 * PCSHOP Data Manager (db.js)
 * Transition from localStorage to File-based JSON storage
 */
(function() {
    const { ipcRenderer } = require('electron');
    const fs = require('fs');
    const path = require('path');

    // Get Data directory from Main process (Synchronous for initialization)
    const DATA_DIR = ipcRenderer.sendSync('get-path-sync', 'userData-data');
    const DB_FILE = path.join(DATA_DIR, 'db.json');

    // In-memory data cache
    let dbCache = {};

    /**
     * Initialize DB: Load file data
     */
    function initDB() {
        try {
            // 1. Create data directory if not exists (Double check)
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
            }

            // 2. Load existing file data if it exists
            if (fs.existsSync(DB_FILE)) {
                const rawData = fs.readFileSync(DB_FILE, 'utf8');
                dbCache = JSON.parse(rawData || '{}');
            } else {
                // First time run or file deleted: Start fresh
                dbCache = {};
                saveToDisk();
            }
            console.log('Database initialized at:', DB_FILE);
        } catch (err) {
            console.error('Failed to initialize DB:', err);
            dbCache = {};
        }
    }

    /**
     * Save current cache to disk
     */
    function saveToDisk() {
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf8');
        } catch (err) {
            console.error('Failed to save DB to disk:', err);
        }
    }

    // Public API
    window.DB = {
        get: (key) => {
            return dbCache[key];
        },
        set: (key, value) => {
            if (typeof value !== 'string') {
                value = JSON.stringify(value);
            }
            dbCache[key] = value;
            saveToDisk();
        },
        remove: (key) => {
            delete dbCache[key];
            saveToDisk();
        },
        exportAll: () => {
            return { ...dbCache };
        },
        importAll: (data) => {
            dbCache = { ...data };
            saveToDisk();
        }
    };

    // Run initialization
    initDB();
})();
