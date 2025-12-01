export async function savePoses(key, poses) {
    // Try IndexedDB first (handles larger data)
    try {
        if ('indexedDB' in window) {
            await saveToIndexedDB(key, poses);
            console.log(`✅ Saved ${poses.length} poses to IndexedDB`);
            return;
        }
    } catch (error) {
        console.warn('IndexedDB save failed, trying localStorage:', error);
    }

    // Fallback to localStorage
    try {
        const data = JSON.stringify(poses);
        localStorage.setItem(key, data);
        console.log(`✅ Saved ${poses.length} poses to localStorage`);
    } catch (error) {
        console.error('Error saving poses:', error);
        if (error.name === 'QuotaExceededError') {
            throw new Error('Storage quota exceeded. Use IndexedDB for larger videos.');
        }
        throw error;
    }
}

export async function loadPoses(key) {
    // First, try loading from file in public/poses folder
    try {
        const fileName = key.replace('danceBattle_', '') + '.json';
        const response = await fetch(`/poses/${fileName}`);
        if (response.ok) {
            const poses = await response.json();
            if (Array.isArray(poses) && poses.length > 0) {
                console.log(`✅ Loaded ${poses.length} poses from file: ${fileName}`);
                return poses;
            }
        }
    } catch (error) {
        console.log(`No file found for ${key}, trying browser storage...`);
    }

    // Fallback to IndexedDB
    try {
        if ('indexedDB' in window) {
            const dbData = await loadFromIndexedDB(key);
            if (dbData && Array.isArray(dbData) && dbData.length > 0) {
                console.log(`✅ Loaded ${dbData.length} poses from IndexedDB`);
                return dbData;
            }
        }
    } catch (error) {
        console.warn('IndexedDB load failed, trying localStorage:', error);
    }

    // Fallback to localStorage
    try {
        const data = localStorage.getItem(key);
        if (data) {
            const poses = JSON.parse(data);
            if (Array.isArray(poses) && poses.length > 0) {
                console.log(`✅ Loaded ${poses.length} poses from localStorage`);
                return poses;
            }
        }
    } catch (error) {
        console.error('Error loading saved poses:', error);
    }
    return null;
}

async function saveToIndexedDB(key, data) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('DanceBattleDB', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['poses'], 'readwrite');
            const store = transaction.objectStore('poses');
            const putRequest = store.put({ key, data, timestamp: Date.now() });
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('poses')) {
                db.createObjectStore('poses', { keyPath: 'key' });
            }
        };
    });
}

async function loadFromIndexedDB(key) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('DanceBattleDB', 1);

        request.onerror = () => resolve(null);
        request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('poses')) {
                resolve(null);
                return;
            }
            const transaction = db.transaction(['poses'], 'readonly');
            const store = transaction.objectStore('poses');
            const getRequest = store.get(key);
            getRequest.onsuccess = () => {
                if (getRequest.result) {
                    resolve(getRequest.result.data);
                } else {
                    resolve(null);
                }
            };
            getRequest.onerror = () => resolve(null);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('poses')) {
                db.createObjectStore('poses', { keyPath: 'key' });
            }
        };
    });
}

