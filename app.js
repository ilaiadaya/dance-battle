class DanceBattleApp {
    constructor() {
        this.poseDetector = new PoseDetector();
        this.movementComparer = new MovementComparer();
        this.scoreManager = new ScoreManager(1000);
        
        this.referenceVideo = document.getElementById('referenceVideo');
        this.cameraVideo = document.getElementById('cameraVideo');
        this.referenceCanvas = document.getElementById('referenceCanvas');
        this.cameraCanvas = document.getElementById('cameraCanvas');
        
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.statusEl = document.getElementById('status');
        this.scoreEl = document.getElementById('score');
        this.targetEl = document.getElementById('target');
        this.matchIndicator = document.getElementById('matchIndicator');
        this.matchOverlay = document.getElementById('matchOverlay');
        
        this.isRunning = false;
        this.camera = null;
        this.referencePoses = [];
        this.isAnalyzingReference = false;
        this.lastSimilarity = 0;
        
        // Storage key for saving poses
        this.STORAGE_KEY = 'danceBattle_referencePoses_dancetwo';
        
        this.setupEventListeners();
        this.setupScoreManager();
        
        // Try to load saved poses immediately on page load
        this.loadSavedPosesOnInit();
        
        // Initialize video analyzer
        this.videoAnalyzer = new VideoAnalyzer(this.poseDetector);
    }

    async loadSavedPosesOnInit() {
        const savedPoses = await this.loadSavedPoses();
        if (savedPoses && savedPoses.length > 0) {
            this.referencePoses = savedPoses;
            this.movementComparer.setReferencePoses(this.referencePoses);
            console.log(`Pre-loaded ${this.referencePoses.length} poses`);
        }
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
        document.getElementById('analyzeBtn').addEventListener('click', () => {
            this.videoAnalyzer.show();
        });
    }

    setupScoreManager() {
        this.scoreManager.onScoreUpdate = (score, target) => {
            this.scoreEl.textContent = Math.floor(score);
            this.targetEl.textContent = target;
        };

        this.scoreManager.onWin = () => {
            this.statusEl.textContent = '🎉 You Win! Great dancing! 🎉';
            this.stop();
        };
    }

    async start() {
        if (this.isRunning) return;

        this.statusEl.textContent = 'Initializing camera...';
        this.startBtn.disabled = true;

        try {
            // Initialize pose detector
            await this.poseDetector.initialize();

            // Start camera
            await this.startCamera();

            // Check if we already have poses loaded (from init)
            if (this.referencePoses.length === 0) {
                // Try to load saved poses
                const savedPoses = await this.loadSavedPoses();
                if (savedPoses && savedPoses.length > 0) {
                    this.referencePoses = savedPoses;
                    this.movementComparer.setReferencePoses(this.referencePoses);
                    this.statusEl.textContent = `✅ Loaded ${this.referencePoses.length} saved poses - Ready!`;
                } else {
                    // Analyze reference video if not saved
                    this.statusEl.textContent = 'Analyzing reference dance (this only happens once)...';
                    try {
                        await this.analyzeReferenceVideo();
                        if (this.referencePoses.length === 0) {
                            throw new Error('No poses detected in reference video. Make sure the video contains a visible person.');
                        }
                        // Save the analyzed poses
                        this.savePoses(this.referencePoses);
                        this.statusEl.textContent = `✅ Analyzed and saved ${this.referencePoses.length} poses!`;
                    } catch (error) {
                        console.error('Error analyzing reference video:', error);
                        this.statusEl.textContent = 'Error analyzing video: ' + error.message;
                        this.startBtn.disabled = false;
                        return;
                    }
                }
            } else {
                // Poses already loaded from init
                this.statusEl.textContent = `✅ Using ${this.referencePoses.length} saved poses - Ready!`;
            }

            this.statusEl.textContent = 'Dance battle started! Follow the moves!';
            this.isRunning = true;
            this.stopBtn.disabled = false;
            this.referenceVideo.play();

            // Start overlay loop for reference video
            this.startReferenceOverlayLoop();
            
            // Start comparison loop
            this.startComparisonLoop();
        } catch (error) {
            console.error('Error starting app:', error);
            this.statusEl.textContent = 'Error: ' + error.message;
            this.startBtn.disabled = false;
        }
    }

    async startCamera() {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            }
        });

        this.cameraVideo.srcObject = stream;
        this.camera = stream;
    }

    async analyzeReferenceVideo() {
        this.isAnalyzingReference = true;
        this.referencePoses = [];
        
        return new Promise((resolve, reject) => {
            const video = this.referenceVideo;
            
            const waitForVideo = () => {
                if (video.readyState >= 2 && video.duration) {
                    startAnalysis();
                } else {
                    video.addEventListener('loadedmetadata', () => {
                        if (video.duration) {
                            startAnalysis();
                        }
                    }, { once: true });
                    video.addEventListener('error', () => {
                        reject(new Error('Failed to load reference video'));
                    });
                }
            };

            const startAnalysis = async () => {
                video.currentTime = 0;
                const fps = 30; // Target frame rate for analysis
                const frameInterval = 1 / fps;
                const maxDuration = video.duration;
                let frameCount = 0;
                const totalFrames = Math.ceil(maxDuration * fps);
                
                // Create a hidden canvas for analysis (faster, no drawing)
                const analysisCanvas = document.createElement('canvas');
                analysisCanvas.width = video.videoWidth || 640;
                analysisCanvas.height = video.videoHeight || 480;
                const analysisCtx = analysisCanvas.getContext('2d');
                
                const analyzeNextFrame = async () => {
                    const currentTime = video.currentTime;
                    
                    if (currentTime >= maxDuration - 0.1) {
                        // Done analyzing
                        this.isAnalyzingReference = false;
                        this.movementComparer.setReferencePoses(this.referencePoses);
                        // Save the analyzed poses
                        this.savePoses(this.referencePoses);
                        this.statusEl.textContent = `Analyzed ${this.referencePoses.length} frames - Ready!`;
                        resolve();
                        return;
                    }

                    // Draw current video frame to canvas
                    try {
                        analysisCtx.drawImage(video, 0, 0, analysisCanvas.width, analysisCanvas.height);
                        
                        // Detect pose in current frame (without drawing)
                        const results = await this.poseDetector.detectPoseOnly(analysisCanvas);
                        const landmarks = this.poseDetector.getPoseLandmarks(results);
                        
                        if (landmarks) {
                            this.referencePoses.push(landmarks);
                        }

                        frameCount++;
                        const progress = Math.min(Math.floor((frameCount / totalFrames) * 100), 100);
                        this.statusEl.textContent = `Analyzing reference dance... ${progress}%`;

                        // Seek to next frame
                        const nextTime = Math.min(currentTime + frameInterval, maxDuration);
                        video.currentTime = nextTime;
                        
                        // Wait for seek to complete
                        await new Promise(seekResolve => {
                            const onSeeked = () => {
                                video.removeEventListener('seeked', onSeeked);
                                seekResolve();
                            };
                            video.addEventListener('seeked', onSeeked, { once: true });
                            
                            // Timeout fallback
                            setTimeout(() => {
                                video.removeEventListener('seeked', onSeeked);
                                seekResolve();
                            }, 100);
                        });
                        
                        // Small delay to ensure frame is ready
                        await new Promise(resolve => setTimeout(resolve, 20));
                        
                        // Continue to next frame
                        analyzeNextFrame();
                    } catch (error) {
                        console.error('Error analyzing frame:', error);
                        // Continue anyway
                        video.currentTime = Math.min(currentTime + frameInterval, maxDuration);
                        await new Promise(resolve => setTimeout(resolve, 50));
                        analyzeNextFrame();
                    }
                };

                // Wait for first frame to be ready
                await new Promise(resolve => {
                    const onSeeked = () => {
                        video.removeEventListener('seeked', onSeeked);
                        setTimeout(resolve, 100); // Give it a moment to render
                    };
                    video.addEventListener('seeked', onSeeked, { once: true });
                });

                analyzeNextFrame();
            };

            waitForVideo();
        });
    }

    startReferenceOverlayLoop() {
        if (!this.isRunning) return;

        // Draw pre-analyzed poses over the reference video
        const videoTime = this.referenceVideo.currentTime;
        const videoDuration = this.referenceVideo.duration;
        
        if (this.referencePoses.length > 0 && videoDuration > 0) {
            const frameIndex = Math.floor(
                (videoTime / videoDuration) * this.referencePoses.length
            ) % this.referencePoses.length;
            
            const referenceLandmarks = this.referencePoses[frameIndex];
            if (referenceLandmarks) {
                this.poseDetector.drawStoredLandmarks(referenceLandmarks, this.referenceCanvas);
            }
        }

        requestAnimationFrame(() => this.startReferenceOverlayLoop());
    }

    async startComparisonLoop() {
        if (!this.isRunning) return;

        try {
            // Only process if camera video is ready
            if (this.cameraVideo.readyState < 2) {
                setTimeout(() => this.startComparisonLoop(), 100);
                return;
            }

            // Detect pose in camera (non-blocking)
            const cameraResults = await this.poseDetector.detectPose(
                this.cameraVideo, 
                this.cameraCanvas
            );
            const userLandmarks = this.poseDetector.getPoseLandmarks(cameraResults);

            // Sync reference pose with video playback time
            const videoTime = this.referenceVideo.currentTime;
            const videoDuration = this.referenceVideo.duration;
            
            if (this.referencePoses.length > 0 && videoDuration > 0) {
                const frameIndex = Math.floor(
                    (videoTime / videoDuration) * this.referencePoses.length
                ) % this.referencePoses.length;
                
                const referenceLandmarks = this.referencePoses[frameIndex];

                // Compare and score
                if (userLandmarks && referenceLandmarks) {
                    const similarity = this.movementComparer.comparePoses(
                        userLandmarks, 
                        referenceLandmarks
                    );

                    // Show visual feedback for good matches
                    this.showMatchFeedback(similarity);

                    // Award points based on similarity
                    // Similarity is 0-1, so we multiply by a base point value
                    const points = Math.floor(similarity * 10);
                    if (points > 0) {
                        this.scoreManager.addPoints(points);
                    }
                    
                    this.lastSimilarity = similarity;
                }
            }
        } catch (error) {
            console.error('Error in comparison loop:', error);
            // Don't stop the loop on error, just log it
        }

        // Continue loop with small delay to prevent blocking
        setTimeout(() => this.startComparisonLoop(), 16); // ~60 fps
    }

    stop() {
        this.isRunning = false;
        this.referenceVideo.pause();
        
        if (this.camera) {
            this.camera.getTracks().forEach(track => track.stop());
            this.camera = null;
        }

        this.cameraVideo.srcObject = null;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.statusEl.textContent = 'Stopped';
        this.scoreManager.reset();
        this.hideMatchFeedback();
    }

    async savePoses(poses) {
        // Try IndexedDB first (handles larger data)
        try {
            if ('indexedDB' in window) {
                await this.saveToIndexedDB(this.STORAGE_KEY, poses);
                console.log(`✅ Saved ${poses.length} poses to IndexedDB`);
                return;
            }
        } catch (error) {
            console.warn('IndexedDB save failed, trying localStorage:', error);
        }

        // Fallback to localStorage
        try {
            const data = JSON.stringify(poses);
            localStorage.setItem(this.STORAGE_KEY, data);
            console.log(`✅ Saved ${poses.length} poses to localStorage`);
        } catch (error) {
            console.error('Error saving poses:', error);
            if (error.name === 'QuotaExceededError') {
                console.warn('❌ Storage quota exceeded. Data not saved. Use the Analysis Tool to save larger videos.');
                this.statusEl.textContent = '⚠️ Data too large for localStorage. Use Analysis Tool to save.';
            }
        }
    }

    async saveToIndexedDB(key, data) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('DanceBattleDB', 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['poses'], 'readwrite');
                const store = transaction.objectStore('poses');
                const putRequest = store.put({ key, data, timestamp: Date.now() });
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('poses')) {
                    db.createObjectStore('poses', { keyPath: 'key' });
                }
            };
        });
    }

    async loadSavedPoses() {
        // Try IndexedDB first
        try {
            if ('indexedDB' in window) {
                const dbData = await this.loadFromIndexedDB(this.STORAGE_KEY);
                if (dbData && Array.isArray(dbData) && dbData.length > 0) {
                    console.log(`✅ Loaded ${dbData.length} poses from IndexedDB`);
                    return dbData;
                }
            }
        } catch (error) {
            console.warn('IndexedDB load failed, trying localStorage:', error);
        }

        // Fallback to localStorage
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (data) {
                const poses = JSON.parse(data);
                if (Array.isArray(poses) && poses.length > 0) {
                    console.log(`✅ Loaded ${poses.length} poses from localStorage`);
                    return poses;
                } else {
                    console.warn('Saved poses data is invalid or empty');
                    localStorage.removeItem(this.STORAGE_KEY);
                }
            } else {
                console.log('No saved poses found in localStorage');
            }
        } catch (error) {
            console.error('Error loading saved poses:', error);
            try {
                localStorage.removeItem(this.STORAGE_KEY);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        return null;
    }

    async loadFromIndexedDB(key) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('DanceBattleDB', 1);

            request.onerror = () => resolve(null);
            request.onsuccess = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('poses')) {
                    resolve(null);
                    return;
                }
                const transaction = db.transaction(['poses'], 'readonly');
                const store = transaction.objectStore('poses');
                const getRequest = store.get(key);
                getRequest.onsuccess = () => {
                    if (getRequest.result) {
                        resolve(getRequest.result.data);
                    } else {
                        resolve(null);
                    }
                };
                getRequest.onerror = () => resolve(null);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('poses')) {
                    db.createObjectStore('poses', { keyPath: 'key' });
                }
            };
        });
    }

    showMatchFeedback(similarity) {
        // Show feedback for good matches (similarity > 0.7)
        if (similarity > 0.7) {
            // Flash indicator for excellent matches (> 0.9)
            if (similarity > 0.9) {
                this.matchIndicator.classList.add('active');
                setTimeout(() => {
                    this.matchIndicator.classList.remove('active');
                }, 500);
            }
            
            // Show overlay on camera section
            this.matchOverlay.classList.add('active');
            setTimeout(() => {
                this.matchOverlay.classList.remove('active');
            }, 300);
        }
    }

    hideMatchFeedback() {
        this.matchIndicator.classList.remove('active');
        this.matchOverlay.classList.remove('active');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.danceBattleApp = new DanceBattleApp();
});

