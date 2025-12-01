#!/usr/bin/env node

/**
 * Preprocess videos and save pose data directly to files
 * This runs in a headless browser and saves to public/poses/ folder
 * 
 * Usage: npm run preprocess-files
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const posesDir = join(projectRoot, 'public', 'poses');
const publicDir = join(projectRoot, 'public');

// Ensure poses directory exists
if (!existsSync(posesDir)) {
  mkdirSync(posesDir, { recursive: true });
}

console.log('🎬 Preprocessing videos and saving to files...\n');

async function preprocessVideos() {
  let browser;
  
  try {
    // Check if videos exist
    const danceonePath = join(publicDir, 'danceone.mp4');
    const dancetwoPath = join(publicDir, 'dancetwo.mp4');
    
    if (!existsSync(danceonePath)) {
      console.error('❌ Error: danceone.mp4 not found in public/ directory');
      process.exit(1);
    }
    
    if (!existsSync(dancetwoPath)) {
      console.error('❌ Error: dancetwo.mp4 not found in public/ directory');
      process.exit(1);
    }

    console.log('🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Create a simple HTML page that will process the videos
    const htmlContent = `
<!DOCTYPE html>
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
    const tempHtmlPath = join(publicDir, 'temp-preprocess.html');
    writeFileSync(tempHtmlPath, htmlContent, 'utf8');

    // Start a simple HTTP server
    const { createServer } = await import('http');
    const { readFileSync } = await import('fs');
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
      res.end(readFileSync(filePath));
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
      
      // Save to files
      console.log('💾 Saving pose data to files...\n');
      
      if (results.danceone && results.danceone.length > 0) {
        const filePath = join(posesDir, 'danceone.json');
        writeFileSync(filePath, JSON.stringify(results.danceone, null, 2), 'utf8');
        console.log(`✅ Saved ${results.danceone.length} poses → danceone.json`);
      }
      
      if (results.dancetwo && results.dancetwo.length > 0) {
        const filePath = join(posesDir, 'dancetwo.json');
        writeFileSync(filePath, JSON.stringify(results.dancetwo, null, 2), 'utf8');
        console.log(`✅ Saved ${results.dancetwo.length} poses → dancetwo.json`);
      }
      
      console.log(`\n✅ Done! All pose data saved to: ${posesDir}\n`);
      console.log('The app will now load from these files automatically.\n');
      
      // Cleanup
      server.close();
      if (existsSync(tempHtmlPath)) {
        const { unlinkSync } = await import('fs');
        unlinkSync(tempHtmlPath);
      }
      
      await browser.close();
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
}

preprocessVideos();

