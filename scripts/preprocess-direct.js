#!/usr/bin/env node

/**
 * Preprocess videos directly using ffmpeg to extract frames
 * Then process frames with MediaPipe in a minimal browser context
 * Saves to local files first, then optionally to PostgreSQL
 * 
 * Usage: npm run preprocess-direct
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const publicDir = join(projectRoot, 'public');
const posesDir = join(publicDir, 'poses');
const framesDir = join(projectRoot, 'temp-frames');

// Load DATABASE_URL from .env if available
let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  try {
    const envPath = join(projectRoot, '.env');
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, 'utf8');
      const match = envContent.match(/DATABASE_URL=(.+)/);
      if (match) {
        databaseUrl = match[1].trim();
      }
    }
  } catch (error) {
    // Ignore
  }
}

const useDatabase = !!databaseUrl;

console.log('🎬 Preprocessing videos (extracting frames, then processing)...\n');
if (useDatabase) {
  console.log('   Will save to files AND PostgreSQL\n');
} else {
  console.log('   Will save to files only\n');
}

// Check if ffmpeg is available
function checkFFmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Extract frames from video using ffmpeg
function extractFrames(videoPath, outputDir, fps = 30) {
  console.log(`📹 Extracting frames from ${videoPath} at ${fps} fps...`);
  
  // Clean output directory
  if (existsSync(outputDir)) {
    const files = readdirSync(outputDir);
    files.forEach(file => unlinkSync(join(outputDir, file)));
  } else {
    mkdirSync(outputDir, { recursive: true });
  }
  
  try {
    // Extract frames using ffmpeg
    execSync(
      `ffmpeg -i "${videoPath}" -vf fps=${fps} "${join(outputDir, 'frame-%06d.png')}" -y`,
      { stdio: 'inherit' }
    );
    
    const frames = readdirSync(outputDir).filter(f => f.endsWith('.png')).sort();
    console.log(`✅ Extracted ${frames.length} frames\n`);
    return frames;
  } catch (error) {
    console.error(`❌ Error extracting frames: ${error.message}`);
    throw error;
  }
}

// Process frames with MediaPipe in browser
async function processFramesWithMediaPipe(frames, videoName) {
  console.log(`🤖 Processing ${frames.length} frames with MediaPipe...`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const page = await browser.newPage();
  
  // Create a simple HTML page that processes frames
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Process Frames</title>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js"></script>
</head>
<body>
    <div id="status">Loading...</div>
    <script>
        const frames = ${JSON.stringify(frames)};
        const framesDir = '/temp-frames';
        
        class PoseDetector {
            constructor() {
                this.pose = null;
                this.isInitialized = false;
            }

            async initialize() {
                if (this.isInitialized) return;

                if (typeof Pose === 'undefined') {
                    await new Promise((resolve) => {
                        const checkPose = setInterval(() => {
                            if (typeof Pose !== 'undefined') {
                                clearInterval(checkPose);
                                resolve();
                            }
                        }, 100);
                    });
                }

                this.pose = new Pose({
                    locateFile: (file) => {
                        return 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/' + file;
                    }
                });

                this.pose.setOptions({
                    modelComplexity: 1,
                    smoothLandmarks: true,
                    enableSegmentation: false,
                    smoothSegmentation: false,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                this.isInitialized = true;
            }

            async detectPoseOnly(imageElement) {
                if (!this.isInitialized) {
                    await this.initialize();
                }

                return new Promise((resolve) => {
                    this.pose.onResults((results) => {
                        resolve(results);
                    });
                    this.pose.send({ image: imageElement });
                });
            }

            getPoseLandmarks(results) {
                return results.poseLandmarks || null;
            }
        }

        async function processAllFrames() {
            const detector = new PoseDetector();
            await detector.initialize();
            
            const poses = [];
            
            for (let i = 0; i < frames.length; i++) {
                const frameName = frames[i];
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                await new Promise((resolve, reject) => {
                    img.onload = async () => {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.width;
                            canvas.height = img.height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0);
                            
                            const results = await detector.detectPoseOnly(canvas);
                            const landmarks = detector.getPoseLandmarks(results);
                            
                            if (landmarks) {
                                poses.push(landmarks);
                            }
                            
                            const progress = Math.floor(((i + 1) / frames.length) * 100);
                            document.getElementById('status').textContent = 
                                'Processing: ' + progress + '% (' + poses.length + ' poses)';
                            
                            resolve();
                        } catch (error) {
                            console.error('Error processing frame:', error);
                            resolve();
                        }
                    };
                    
                    img.onerror = () => {
                        console.error('Failed to load frame:', frameName);
                        resolve();
                    };
                    
                    img.src = framesDir + '/' + frameName;
                });
            }
            
            window.processResults = poses;
            document.getElementById('status').textContent = 
                '✅ Complete! Processed ' + poses.length + ' poses';
        }

        // Wait for MediaPipe to load
        if (typeof Pose !== 'undefined') {
            setTimeout(processAllFrames, 1000);
        } else {
            window.addEventListener('load', () => {
                setTimeout(processAllFrames, 2000);
            });
        }
    </script>
</body>
</html>`;

  // Start a simple HTTP server
  const { createServer } = await import('http');
  const { readFileSync: rf } = await import('fs');
  const { extname } = await import('path');
  
  const server = createServer((req, res) => {
    let filePath;
    
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(htmlContent);
      return;
    }
    
    if (req.url.startsWith('/temp-frames/')) {
      filePath = join(framesDir, req.url.replace('/temp-frames/', ''));
    } else {
      filePath = join(publicDir, req.url);
    }
    
    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    
    const ext = extname(filePath);
    const contentType = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.mp4': 'video/mp4',
      '.html': 'text/html',
      '.js': 'application/javascript'
    }[ext] || 'application/octet-stream';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(rf(filePath));
  });
  
  return new Promise((resolve, reject) => {
    server.listen(8002, async () => {
      try {
        await page.goto('http://localhost:8002', { waitUntil: 'networkidle0' });
        
        // Wait for processing to complete
        await page.waitForFunction(() => {
          return window.processResults !== undefined;
        }, { timeout: 600000 }); // 10 minute timeout
        
        const poses = await page.evaluate(() => window.processResults);
        
        server.close();
        await browser.close();
        
        resolve(poses);
      } catch (error) {
        server.close();
        await browser.close();
        reject(error);
      }
    });
  });
}

// Save poses to files and optionally to database
async function savePoses(poses, videoName) {
  // Always save to files first
  if (!existsSync(posesDir)) {
    mkdirSync(posesDir, { recursive: true });
  }
  
  const filePath = join(posesDir, `${videoName}.json`);
  writeFileSync(filePath, JSON.stringify(poses, null, 2), 'utf8');
  console.log(`✅ Saved ${poses.length} poses → ${filePath}`);
  
  // Optionally save to PostgreSQL
  if (useDatabase) {
    try {
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: databaseUrl,
        ssl: databaseUrl.includes('railway') || databaseUrl.includes('sslmode=require') 
          ? { rejectUnauthorized: false } 
          : false,
        connectionTimeoutMillis: 5000
      });
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS poses (
          key VARCHAR(255) PRIMARY KEY,
          data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await pool.query(
        `INSERT INTO poses (key, data, updated_at) 
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (key) 
         DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP`,
        [`danceBattle_${videoName}`, JSON.stringify(poses)]
      );
      
      console.log(`✅ Saved ${poses.length} poses → PostgreSQL (danceBattle_${videoName})`);
      await pool.end();
    } catch (dbError) {
      console.warn(`⚠️  Could not save to database: ${dbError.message}`);
      console.warn('   But local files are saved, so you can test locally!\n');
    }
  }
}

// Clean up temp frames
function cleanupFrames(dir) {
  if (existsSync(dir)) {
    const files = readdirSync(dir);
    files.forEach(file => unlinkSync(join(dir, file)));
    // Don't remove directory, just clear it
  }
}

async function main() {
  if (!checkFFmpeg()) {
    console.error('❌ Error: ffmpeg is not installed');
    console.error('   Install it: brew install ffmpeg (macOS) or apt-get install ffmpeg (Linux)');
    process.exit(1);
  }
  
  const danceonePath = join(publicDir, 'danceone.mp4');
  const dancetwoPath = join(publicDir, 'dancetwo.mp4');
  
  if (!existsSync(danceonePath) || !existsSync(dancetwoPath)) {
    console.error('❌ Error: Video files not found in public/ directory');
    process.exit(1);
  }
  
  try {
    // Process danceone
    console.log('📹 Processing danceone.mp4...\n');
    const frames1 = extractFrames(danceonePath, join(framesDir, 'danceone'), 30);
    const poses1 = await processFramesWithMediaPipe(
      frames1.map(f => `danceone/${f}`),
      'danceone'
    );
    await savePoses(poses1, 'danceone');
    cleanupFrames(join(framesDir, 'danceone'));
    console.log('');
    
    // Process dancetwo
    console.log('📹 Processing dancetwo.mp4...\n');
    const frames2 = extractFrames(dancetwoPath, join(framesDir, 'dancetwo'), 30);
    const poses2 = await processFramesWithMediaPipe(
      frames2.map(f => `dancetwo/${f}`),
      'dancetwo'
    );
    await savePoses(poses2, 'dancetwo');
    cleanupFrames(join(framesDir, 'dancetwo'));
    
    console.log('\n✅ All done! Pose data saved to files.');
    if (useDatabase) {
      console.log('   Also saved to PostgreSQL.\n');
    } else {
      console.log('   Add DATABASE_URL to .env to also save to PostgreSQL.\n');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

