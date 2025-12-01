#!/usr/bin/env node

/**
 * Extract pose data from browser IndexedDB and save directly to PostgreSQL
 * This uses Puppeteer to access the browser's IndexedDB
 * 
 * Usage: DATABASE_URL=your_postgres_url node scripts/extract-to-postgres.js
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import puppeteer from 'puppeteer';
import pg from 'pg';
const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Try to load from .env file
let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  try {
    const { readFileSync, existsSync } = await import('fs');
    const envPath = join(__dirname, '..', '.env');
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, 'utf8');
      const match = envContent.match(/DATABASE_URL=(.+)/);
      if (match) {
        connectionString = match[1].trim();
      }
    }
  } catch (error) {
    // Ignore
  }
}

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL not found in .env file or environment');
  console.log('\nUsage:');
  console.log('  DATABASE_URL=your_postgres_url node scripts/extract-to-postgres.js');
  console.log('  Or add DATABASE_URL to .env file\n');
  process.exit(1);
}

// Check if it's Railway internal URL (won't work locally)
if (connectionString.includes('railway.internal')) {
  console.warn('⚠️  Warning: Railway internal URL detected.');
  console.warn('   This URL only works inside Railway.');
  console.warn('   For local use, get the public connection URL from Railway dashboard.');
  console.warn('   But this will work fine when deployed on Railway.\n');
  console.log('   Continuing anyway...\n');
}

console.log('🔍 Extracting pose data from browser and saving to PostgreSQL...\n');

async function extractAndSave() {
  let browser;
  const pool = new Pool({
    connectionString: connectionString,
    ssl: connectionString.includes('sslmode=require') || connectionString.includes('railway') ? { rejectUnauthorized: false } : false
  });

  try {
    // Initialize database
    await pool.query(`
      CREATE TABLE IF NOT EXISTS poses (
        key VARCHAR(255) PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Database table ready\n');

    // Launch browser
    console.log('🌐 Opening browser...');
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null
    });

    const page = await browser.newPage();
    
    // Navigate to app
    try {
      await page.goto('http://localhost:8000', { waitUntil: 'networkidle0', timeout: 5000 });
    } catch (error) {
      console.error('❌ Error: Dev server is not running on http://localhost:8000');
      console.error('   Please run: npm run dev\n');
      await browser.close();
      await pool.end();
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
      await pool.end();
      return;
    }

    // Save each pose set to PostgreSQL
    console.log('💾 Saving pose data to PostgreSQL...\n');
    
    for (const [key, data] of Object.entries(poses)) {
      if (Array.isArray(data) && data.length > 0) {
        try {
          await pool.query(
            `INSERT INTO poses (key, data, updated_at) 
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (key) 
             DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP`,
            [key, JSON.stringify(data)]
          );
          console.log(`✅ Saved ${data.length} poses → PostgreSQL (key: ${key})`);
        } catch (error) {
          console.error(`❌ Error saving ${key}:`, error.message);
        }
      }
    }

    console.log(`\n✅ Done! All pose data saved to PostgreSQL.\n`);
    console.log('The app will now load from the database automatically.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Tip: Make sure your DATABASE_URL is accessible from your local machine.');
      console.error('   Railway internal URLs (postgres.railway.internal) only work inside Railway.');
      console.error('   Use the public connection URL from Railway dashboard.\n');
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    await pool.end();
  }
}

extractAndSave();

