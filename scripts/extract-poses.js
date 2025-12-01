#!/usr/bin/env node

/**
 * Extract pose data from browser IndexedDB and save to files
 * This script uses Puppeteer to access the browser's IndexedDB
 * 
 * Usage: npm run extract-poses
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const posesDir = join(projectRoot, 'public', 'poses');

// Ensure poses directory exists
if (!existsSync(posesDir)) {
  mkdirSync(posesDir, { recursive: true });
}

console.log('🔍 Extracting pose data from browser storage...\n');

async function extractPoses() {
  let browser;
  
  try {
    // Launch browser (or connect to existing)
    console.log('🌐 Opening browser...');
    browser = await puppeteer.launch({
      headless: false, // We need to see it to access IndexedDB
      defaultViewport: null
    });

    const page = await browser.newPage();
    
    // Check if server is running
    try {
      await page.goto('http://localhost:8000', { waitUntil: 'networkidle0', timeout: 5000 });
    } catch (error) {
      console.error('❌ Error: Dev server is not running on http://localhost:8000');
      console.error('   Please run: npm run dev\n');
      await browser.close();
      return;
    }
    
    console.log('📦 Accessing IndexedDB...\n');

    // Extract data from IndexedDB
    const poses = await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('DanceBattleDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('poses')) {
            resolve({});
            return;
          }
          
          const transaction = db.transaction(['poses'], 'readonly');
          const store = transaction.objectStore('poses');
          const getAllRequest = store.getAll();
          
          getAllRequest.onsuccess = () => {
            const result = {};
            getAllRequest.result.forEach((item) => {
              result[item.key] = item.data;
            });
            resolve(result);
          };
          
          getAllRequest.onerror = () => reject(getAllRequest.error);
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('poses')) {
            db.createObjectStore('poses', { keyPath: 'key' });
          }
        };
      });
    });

    if (Object.keys(poses).length === 0) {
      console.log('❌ No pose data found in IndexedDB.');
      console.log('   Make sure you have run the preprocessing first.\n');
      await browser.close();
      return;
    }

    // Save each pose set to a file
    console.log('💾 Saving pose data to files...\n');
    
    for (const [key, data] of Object.entries(poses)) {
      if (Array.isArray(data) && data.length > 0) {
        const fileName = key.replace('danceBattle_', '') + '.json';
        const filePath = join(posesDir, fileName);
        writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`✅ Saved ${data.length} poses → ${fileName}`);
      }
    }

    console.log(`\n✅ Done! All pose data saved to: ${posesDir}\n`);
    console.log('The app will now load from these files automatically.\n');

  } catch (error) {
    if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      console.error('❌ Error: Dev server is not running.');
      console.error('   Please run: npm run dev\n');
    } else {
      console.error('❌ Error:', error.message);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

extractPoses();

