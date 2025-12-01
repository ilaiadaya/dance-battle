#!/usr/bin/env node

/**
 * Preprocessing script for dance videos
 * This script opens the preprocessing page in your browser
 * 
 * Usage: npm run preprocess
 * Or: node scripts/preprocess.js
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import http from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🎬 Dance Battle Video Preprocessor\n');
console.log('This script will:');
console.log('  1. Start the dev server (if not running)');
console.log('  2. Open the preprocessing page in your browser');
console.log('  3. Analyze danceone.mp4 and dancetwo.mp4');
console.log('  4. Save the pose data to IndexedDB\n');

// Check if videos exist
const danceonePath = join(projectRoot, 'public', 'danceone.mp4');
const dancetwoPath = join(projectRoot, 'public', 'dancetwo.mp4');

if (!existsSync(danceonePath)) {
  console.error('❌ Error: danceone.mp4 not found in public/ directory');
  process.exit(1);
}

if (!existsSync(dancetwoPath)) {
  console.error('❌ Error: dancetwo.mp4 not found in public/ directory');
  process.exit(1);
}

console.log('✅ Video files found\n');

// Function to open browser
function openBrowser(url) {
  const platform = process.platform;
  let command;

  switch (platform) {
    case 'darwin': // macOS
      command = 'open';
      break;
    case 'win32': // Windows
      command = 'start';
      break;
    default: // Linux and others
      command = 'xdg-open';
      break;
  }

  spawn(command, [url], { stdio: 'ignore' });
}

// Check if dev server is running
const checkServer = () => {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:8000', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
};

// Start dev server if not running
const startDevServer = () => {
  return new Promise((resolve) => {
    console.log('🚀 Starting dev server...\n');
    const server = spawn('npm', ['run', 'dev'], {
      cwd: projectRoot,
      stdio: 'pipe',
      shell: true
    });

    let serverReady = false;

    server.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output);
      
      if (output.includes('Local:') && !serverReady) {
        serverReady = true;
        setTimeout(() => {
          console.log('\n✅ Dev server is ready!\n');
          resolve();
        }, 2000);
      }
    });

    server.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    // Timeout fallback
    setTimeout(() => {
      if (!serverReady) {
        console.log('\n⏳ Waiting for server to start...\n');
        serverReady = true;
        resolve();
      }
    }, 5000);
  });
};

// Main execution
(async () => {
  try {
    // Check if server is already running
    const isRunning = await checkServer();
    
    if (!isRunning) {
      await startDevServer();
    } else {
      console.log('✅ Dev server is already running\n');
    }

    // Wait a bit for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Open preprocessing page
    const preprocessUrl = 'http://localhost:8000/preprocess.html';
    console.log(`🌐 Opening preprocessing page: ${preprocessUrl}\n`);
    openBrowser(preprocessUrl);

    console.log('📋 Instructions:');
    console.log('  1. The preprocessing page should open in your browser');
    console.log('  2. Wait for both videos to be analyzed (this may take several minutes)');
    console.log('  3. You\'ll see progress updates in the browser');
    console.log('  4. When complete, the pose data will be saved to IndexedDB');
    console.log('  5. You can then use the app normally - it will load the preprocessed data\n');
    console.log('💡 Tip: Keep this terminal open to see server logs');
    console.log('💡 Tip: Open browser DevTools (F12) to see detailed progress\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();

