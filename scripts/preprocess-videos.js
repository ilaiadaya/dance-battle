import { createServer } from 'http';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createReadStream } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// This script will be run in the browser context via a special HTML page
// We'll create a preprocessing page that can be opened in the browser

const preprocessHTML = `<!DOCTYPE html>
<html>
<head>
    <title>Preprocess Videos</title>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js"></script>
</head>
<body>
    <h1>Video Preprocessing</h1>
    <div id="status">Loading MediaPipe...</div>
    <div id="progress"></div>
    <script type="module">
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
                        return \`https://cdn.jsdelivr.net/npm/@mediapipe/pose/\${file}\`;
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
                            document.getElementById('status').textContent = 
                                \`✅ \${videoName}: Analyzed \${poses.length} frames\`;
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
                            document.getElementById('progress').innerHTML = 
                                \`<div>\${videoName}: \${progress}% (\${poses.length} poses)</div>\`;

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
                    reject(new Error(\`Failed to load video: \${videoPath}\`));
                });
            });
        }

        async function preprocessAll() {
            document.getElementById('status').textContent = 'Starting preprocessing...';
            
            try {
                // Analyze danceone.mp4
                document.getElementById('status').textContent = 'Analyzing danceone.mp4...';
                const poses1 = await analyzeVideo('/danceone.mp4', 'danceone');
                
                // Save to IndexedDB
                const key1 = 'danceBattle_danceone';
                const request1 = indexedDB.open('DanceBattleDB', 1);
                request1.onsuccess = () => {
                    const db = request1.result;
                    if (!db.objectStoreNames.contains('poses')) {
                        db.createObjectStore('poses', { keyPath: 'key' });
                    }
                    const transaction = db.transaction(['poses'], 'readwrite');
                    const store = transaction.objectStore('poses');
                    store.put({ key: key1, data: poses1, timestamp: Date.now() });
                    console.log(\`Saved \${poses1.length} poses for danceone\`);
                };
                request1.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('poses')) {
                        db.createObjectStore('poses', { keyPath: 'key' });
                    }
                };

                // Analyze dancetwo.mp4
                document.getElementById('status').textContent = 'Analyzing dancetwo.mp4...';
                const poses2 = await analyzeVideo('/dancetwo.mp4', 'dancetwo');
                
                // Save to IndexedDB
                const key2 = 'danceBattle_dancetwo';
                const request2 = indexedDB.open('DanceBattleDB', 1);
                request2.onsuccess = () => {
                    const db = request2.result;
                    const transaction = db.transaction(['poses'], 'readwrite');
                    const store = transaction.objectStore('poses');
                    store.put({ key: key2, data: poses2, timestamp: Date.now() });
                    console.log(\`Saved \${poses2.length} poses for dancetwo\`);
                };

                document.getElementById('status').textContent = 
                    \`✅ Preprocessing complete!\\n\\nDanceone: \${poses1.length} poses\\nDancetwo: \${poses2.length} poses\`;
            } catch (error) {
                document.getElementById('status').textContent = \`❌ Error: \${error.message}\`;
                console.error(error);
            }
        }

        // Wait for MediaPipe to load, then start
        if (typeof Pose !== 'undefined') {
            preprocessAll();
        } else {
            window.addEventListener('load', () => {
                setTimeout(preprocessAll, 1000);
            });
        }
    </script>
</body>
</html>`;

writeFileSync(join(__dirname, '../public/preprocess.html'), preprocessHTML);

console.log('✅ Created preprocessing page at public/preprocess.html');
console.log('📝 To preprocess videos:');
console.log('   1. Run: npm run dev');
console.log('   2. Open: http://localhost:8000/preprocess.html');
console.log('   3. Wait for both videos to be analyzed');
console.log('   4. The data will be saved to IndexedDB automatically');

