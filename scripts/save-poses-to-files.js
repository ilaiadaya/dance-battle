#!/usr/bin/env node

/**
 * Script to save pose data from browser storage to files
 * Run this after preprocessing to save the data to public/poses/
 * 
 * Usage: node scripts/save-poses-to-files.js
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const posesDir = join(projectRoot, 'public', 'poses');

// Ensure poses directory exists
if (!existsSync(posesDir)) {
  mkdirSync(posesDir, { recursive: true });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

console.log('📁 Save Poses to Files\n');
console.log('This script will help you save pose data from browser storage to files.\n');
console.log('After preprocessing, the data is saved to IndexedDB in your browser.');
console.log('You need to export it and provide the JSON data here.\n');
console.log('Steps:');
console.log('  1. Open the app in your browser');
console.log('  2. Click "Export Data" button (or use browser DevTools)');
console.log('  3. Copy the JSON content');
console.log('  4. Paste it here when prompted\n');

async function savePoseFile(key, data) {
  const fileName = key.replace('danceBattle_', '') + '.json';
  const filePath = join(posesDir, fileName);
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✅ Saved ${data.length} poses to: ${filePath}`);
}

async function main() {
  try {
    console.log('Which video do you want to save?');
    console.log('  1. danceone');
    console.log('  2. dancetwo');
    console.log('  3. Both');
    console.log('  4. Custom (paste JSON directly)\n');
    
    const choice = await question('Enter choice (1-4): ');
    
    if (choice === '1' || choice === '3') {
      console.log('\n📋 For danceone:');
      console.log('  1. Open browser DevTools (F12)');
      console.log('  2. Go to Application tab → IndexedDB → DanceBattleDB → poses');
      console.log('  3. Find "danceBattle_danceone" and copy the "data" array');
      console.log('  4. Or use the Export Data button in the app\n');
      
      const danceoneData = await question('Paste danceone JSON data (or press Enter to skip): ');
      if (danceoneData.trim()) {
        try {
          const poses = JSON.parse(danceoneData.trim());
          if (Array.isArray(poses)) {
            await savePoseFile('danceBattle_danceone', poses);
          } else {
            console.log('❌ Invalid format: Expected an array of poses');
          }
        } catch (error) {
          console.log(`❌ Error parsing JSON: ${error.message}`);
        }
      }
    }
    
    if (choice === '2' || choice === '3') {
      console.log('\n📋 For dancetwo:');
      console.log('  1. Open browser DevTools (F12)');
      console.log('  2. Go to Application tab → IndexedDB → DanceBattleDB → poses');
      console.log('  3. Find "danceBattle_dancetwo" and copy the "data" array');
      console.log('  4. Or use the Export Data button in the app\n');
      
      const dancetwoData = await question('Paste dancetwo JSON data (or press Enter to skip): ');
      if (dancetwoData.trim()) {
        try {
          const poses = JSON.parse(dancetwoData.trim());
          if (Array.isArray(poses)) {
            await savePoseFile('danceBattle_dancetwo', poses);
          } else {
            console.log('❌ Invalid format: Expected an array of poses');
          }
        } catch (error) {
          console.log(`❌ Error parsing JSON: ${error.message}`);
        }
      }
    }
    
    if (choice === '4') {
      console.log('\n📋 Paste the full JSON export (from Export Data button):\n');
      const fullData = await question('Paste JSON: ');
      if (fullData.trim()) {
        try {
          const data = JSON.parse(fullData.trim());
          if (data.poses && typeof data.poses === 'object') {
            for (const [key, poses] of Object.entries(data.poses)) {
              if (Array.isArray(poses)) {
                await savePoseFile(key, poses);
              }
            }
          } else if (Array.isArray(data)) {
            const key = await question('Enter key name (e.g., danceone or dancetwo): ');
            await savePoseFile(`danceBattle_${key}`, data);
          } else {
            console.log('❌ Invalid format');
          }
        } catch (error) {
          console.log(`❌ Error parsing JSON: ${error.message}`);
        }
      }
    }
    
    console.log('\n✅ Done! Files saved to public/poses/');
    console.log('The app will now load poses from these files automatically.\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

main();

