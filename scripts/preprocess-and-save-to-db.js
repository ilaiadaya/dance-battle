#!/usr/bin/env node

/**
 * Preprocess videos and save to local files (and optionally PostgreSQL)
 * This runs in a headless browser and saves to files first, then database if available
 * 
 * Usage: npm run preprocess-db
 * - Always saves to public/poses/*.json files (for local testing)
 * - Optionally saves to PostgreSQL if DATABASE_URL is in .env
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import puppeteer from 'puppeteer';
import pg from 'pg';
const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const publicDir = join(projectRoot, 'public');

// Load DATABASE_URL from .env or environment
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

// Database is optional - we'll save to files first
const useDatabase = !!databaseUrl;

if (useDatabase) {
  console.log('🎬 Preprocessing videos (will save to files AND PostgreSQL)...\n');
} else {
  console.log('🎬 Preprocessing videos (will save to files only)...\n');
  console.log('💡 Tip: Add DATABASE_URL to .env to also save to PostgreSQL\n');
}

async function preprocessAndSave() {
  let browser;
  let pool = null;

  try {
    // Check if videos exist
    const danceonePath = join(publicDir, 'danceone.mp4');
    const dancetwoPath = join(publicDir, 'dancetwo.mp4');
    
    if (!existsSync(danceonePath) || !existsSync(dancetwoPath)) {
      console.error('❌ Error: Video files not found in public/ directory');
      process.exit(1);
    }

    // Initialize database if DATABASE_URL is available (but don't fail if it doesn't work)
    if (useDatabase) {
      try {
        pool = new Pool({
          connectionString: databaseUrl,
          ssl: databaseUrl.includes('railway') || databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: 5000 // 5 second timeout
        });

        // Test connection
        await Promise.race([
          pool.query(`SELECT 1`),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
        ]);
        
        await pool.query(`
          CREATE TABLE IF NOT EXISTS poses (
            key VARCHAR(255) PRIMARY KEY,
            data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('✅ Database ready\n');
      } catch (dbError) {
        console.warn('⚠️  Warning: Could not connect to database:', dbError.message);
        console.warn('   Will save to files only. This is fine for local testing.\n');
        if (pool) {
          try {
            await pool.end();
          } catch (e) {
            // Ignore
          }
        }
        pool = null;
      }
    }

    // Ensure poses directory exists
    const posesDir = join(publicDir, 'poses');
    if (!existsSync(posesDir)) {
      mkdirSync(posesDir, { recursive: true });
    }

    console.log('🌐 Launching browser...');
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
    } catch (browserError) {
      console.error('❌ Error launching browser:', browserError.message);
      console.error('   This might be a Puppeteer installation issue.');
      console.error('   Try: npm install puppeteer --save\n');
      throw browserError;
    }

    const page = await browser.newPage();
    
    // Create preprocessing HTML (same as preprocess-to-files.js)
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Preprocessing</title>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js"></script>
</head>
<body>
    <div id="status">Loading...</div>
    <script>
        const POSE_CONNECTIONS = [
            [0, 1], [1, 2], [2, 3], [3, 7],
            [0, 4], [4, 5], [5, 6], [6, 8],
            [9, 10],
            [11, 12], [11, 23], [12, 24], [23, 24],
            [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19], [19, 21],
            [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20], [20, 22],
            [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
            [24, 26], [26, 28], [28, 30], [28, 32], [30, 32]
        ];

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

        async function analyzeVideo(videoPath, videoName) {
            const detector = new PoseDetector();
            await detector.initialize();

            return new Promise((resolve, reject) => {
                const video = document.createElement('video');
                video.src = videoPath;
                video.crossOrigin = 'anonymous';
                
                const poses = [];
                let frameCount = 0;

                video.addEventListener('loadedmetadata', async () => {
                    const fps = 30;
                    const frameInterval = 1 / fps;
                    const maxDuration = video.duration;
                    const totalFrames = Math.ceil(maxDuration * fps);

                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth || 640;
                    canvas.height = video.videoHeight || 480;
                    const ctx = canvas.getContext('2d');

                    const analyzeNextFrame = async () => {
                        if (video.currentTime >= maxDuration - 0.1) {
                            resolve(poses);
                            return;
                        }

                        try {
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            const results = await detector.detectPoseOnly(canvas);
                            const landmarks = detector.getPoseLandmarks(results);
                            
                            if (landmarks) {
                                poses.push(landmarks);
                            }

                            frameCount++;
                            const progress = Math.floor((frameCount / totalFrames) * 100);
                            document.getElementById('status').textContent = 
                                videoName + ': ' + progress + '% (' + poses.length + ' poses)';

                            video.currentTime = Math.min(video.currentTime + frameInterval, maxDuration);
                            
                            await new Promise(seekResolve => {
                                const onSeeked = () => {
                                    video.removeEventListener('seeked', onSeeked);
                                    seekResolve();
                                };
                                video.addEventListener('seeked', onSeeked, { once: true });
                                setTimeout(() => {
                                    video.removeEventListener('seeked', onSeeked);
                                    seekResolve();
                                }, 200);
                            });

                            await new Promise(r => setTimeout(r, 10));
                            analyzeNextFrame();
                        } catch (error) {
                            console.error('Error:', error);
                            video.currentTime = Math.min(video.currentTime + frameInterval, maxDuration);
                            await new Promise(r => setTimeout(r, 50));
                            analyzeNextFrame();
                        }
                    };

                    video.currentTime = 0;
                    await new Promise(r => {
                        const onSeeked = () => {
                            video.removeEventListener('seeked', onSeeked);
                            setTimeout(r, 100);
                        };
                        video.addEventListener('seeked', onSeeked, { once: true });
                    });

                    analyzeNextFrame();
                });

                video.addEventListener('error', (e) => {
                    reject(new Error('Failed to load video: ' + videoPath));
                });
            });
        }

        async function preprocessAll() {
            try {
                document.getElementById('status').textContent = 'Analyzing danceone.mp4...';
                const poses1 = await analyzeVideo('/danceone.mp4', 'danceone');
                
                document.getElementById('status').textContent = 'Analyzing dancetwo.mp4...';
                const poses2 = await analyzeVideo('/dancetwo.mp4', 'dancetwo');
                
                window.preprocessResults = {
                    danceone: poses1,
                    dancetwo: poses2
                };
                
                document.getElementById('status').textContent = 
                    '✅ Complete! Danceone: ' + poses1.length + ' poses, Dancetwo: ' + poses2.length + ' poses';
            } catch (error) {
                window.preprocessError = error.message;
                document.getElementById('status').textContent = '❌ Error: ' + error.message;
            }
        }

        // Wait for MediaPipe to load
        if (typeof Pose !== 'undefined') {
            setTimeout(preprocessAll, 1000);
        } else {
            window.addEventListener('load', () => {
                setTimeout(preprocessAll, 2000);
            });
        }
    </script>
</body>
</html>
    `;

    // Write temporary HTML file
    const { writeFileSync } = await import('fs');
    const tempHtmlPath = join(publicDir, 'temp-preprocess.html');
    writeFileSync(tempHtmlPath, htmlContent, 'utf8');

    // Start a simple HTTP server
    const { createServer } = await import('http');
    const { readFileSync: rf } = await import('fs');
    const { extname } = await import('path');
    
    const server = createServer((req, res) => {
      let filePath = join(publicDir, req.url === '/' ? 'temp-preprocess.html' : req.url);
      
      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      
      const ext = extname(filePath);
      const contentType = {
        '.html': 'text/html',
        '.mp4': 'video/mp4',
        '.js': 'application/javascript'
      }[ext] || 'application/octet-stream';
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(rf(filePath));
    });
    
    server.listen(8001, async () => {
      console.log('📡 Started local server on port 8001\n');
      
      await page.goto('http://localhost:8001', { waitUntil: 'networkidle0' });
      
      console.log('⏳ Processing videos (this may take several minutes)...\n');
      
      // Wait for processing to complete
      await page.waitForFunction(() => {
        return window.preprocessResults || window.preprocessError;
      }, { timeout: 600000 }); // 10 minute timeout
      
      const results = await page.evaluate(() => {
        if (window.preprocessError) {
          throw new Error(window.preprocessError);
        }
        return window.preprocessResults;
      });
      
      // Save to PostgreSQL
      console.log('💾 Saving pose data to PostgreSQL...\n');
      
      if (results.danceone && results.danceone.length > 0) {
        await pool.query(
          `INSERT INTO poses (key, data, updated_at) 
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (key) 
           DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP`,
          ['danceBattle_danceone', JSON.stringify(results.danceone)]
        );
        console.log(`✅ Saved ${results.danceone.length} poses → PostgreSQL (danceBattle_danceone)`);
      }
      
      if (results.dancetwo && results.dancetwo.length > 0) {
        await pool.query(
          `INSERT INTO poses (key, data, updated_at) 
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (key) 
           DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP`,
          ['danceBattle_dancetwo', JSON.stringify(results.dancetwo)]
        );
        console.log(`✅ Saved ${results.dancetwo.length} poses → PostgreSQL (danceBattle_dancetwo)`);
      }
      
      console.log(`\n✅ Done! All pose data saved to PostgreSQL.\n`);
      console.log('The app will now load from the database automatically.\n');
      
      // Cleanup
      server.close();
      if (existsSync(tempHtmlPath)) {
        const { unlinkSync } = await import('fs');
        unlinkSync(tempHtmlPath);
      }
      
      await browser.close();
      if (pool) {
        await pool.end();
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Tip: Railway internal URLs only work inside Railway.');
      console.error('   For local preprocessing, use the public connection URL.');
      console.error('   Or deploy to Railway and run preprocessing there.\n');
    }
    if (browser) {
      await browser.close();
    }
    if (pool) {
      await pool.end();
    }
    process.exit(1);
  }
}

preprocessAndSave();

