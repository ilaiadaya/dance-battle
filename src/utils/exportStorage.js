/**
 * Utility functions to export and import pose data as files
 */

export async function exportPoses(key, poses) {
  const dataStr = JSON.stringify(poses, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${key}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return `${key}.json`;
}

export async function exportAllPoses() {
  const allPoses = await getAllPoses();
  const exportData = {
    exportedAt: new Date().toISOString(),
    poses: allPoses
  };
  
  const dataStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dance-battle-poses-export-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function getAllPoses() {
  const allPoses = {};
  
  // Get from IndexedDB
  if ('indexedDB' in window) {
    try {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('DanceBattleDB', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('poses')) {
            db.createObjectStore('poses', { keyPath: 'key' });
          }
        };
      });
      
      if (db.objectStoreNames.contains('poses')) {
        const transaction = db.transaction(['poses'], 'readonly');
        const store = transaction.objectStore('poses');
        const getAllRequest = store.getAll();
        
        await new Promise((resolve) => {
          getAllRequest.onsuccess = () => {
            getAllRequest.result.forEach((item) => {
              allPoses[item.key] = item.data;
            });
            resolve();
          };
        });
      }
    } catch (error) {
      console.warn('Error reading from IndexedDB:', error);
    }
  }
  
  // Get from localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('danceBattle_')) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(data)) {
          allPoses[key] = data;
        }
      } catch (e) {
        // Skip invalid entries
      }
    }
  }
  
  return allPoses;
}

export async function importPosesFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        // Handle single pose array
        if (Array.isArray(data)) {
          const fileName = file.name.replace(/\.[^/.]+$/, '');
          const key = fileName.startsWith('danceBattle_') ? fileName : `danceBattle_${fileName}`;
          await import('./storage.js').then(({ savePoses }) => savePoses(key, data));
          resolve({ key, count: data.length });
        }
        // Handle export format
        else if (data.poses && typeof data.poses === 'object') {
          const results = [];
          for (const [key, poses] of Object.entries(data.poses)) {
            await import('./storage.js').then(({ savePoses }) => savePoses(key, poses));
            results.push({ key, count: poses.length });
          }
          resolve(results);
        }
        else {
          reject(new Error('Invalid file format'));
        }
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

