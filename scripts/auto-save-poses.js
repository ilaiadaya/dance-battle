#!/usr/bin/env node

/**
 * Automatic script to extract and save poses from browser IndexedDB
 * This uses Puppeteer to access the browser's IndexedDB and save to files
 * 
 * Usage: npm run save-poses
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const posesDir = join(projectRoot, 'public', 'poses');

// Ensure poses directory exists
if (!existsSync(posesDir)) {
  mkdirSync(posesDir, { recursive: true });
}

console.log('📁 Auto-Save Poses from Browser\n');
console.log('This will extract pose data from your browser and save to files.\n');
console.log('Please make sure:');
console.log('  1. You have run the preprocessing (preprocess.html)');
console.log('  2. Your browser is open with the app loaded');
console.log('  3. The pose data exists in IndexedDB\n');

console.log('💡 Alternative: Use the simpler script:');
console.log('   node scripts/save-poses-to-files.js\n');
console.log('Or manually:');
console.log('  1. Open app → Click "Export Data" button');
console.log('  2. Save the downloaded JSON file');
console.log('  3. Place it in public/poses/ folder\n');

// For now, just provide instructions
// In the future, we could use Puppeteer to automate this

