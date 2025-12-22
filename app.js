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
        this.danceSelect = document.getElementById('danceSelect');
        
        this.isRunning = false;
        this.camera = null;
        this.referencePoses = [];
        this.isAnalyzingReference = false;
        this.lastSimilarity = 0;
        this.currentDanceName = 'dancetwo';
        
        // API base URL
        this.API_BASE = 'http://localhost:3000/api';
        
        this.setupEventListeners();
        this.setupScoreManager();
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.danceSelect.addEventListener('change', () => this.onDanceChange());
    }

    onDanceChange() {
        const selectedDance = this.danceSelect.value;
        this.currentDanceName = selectedDance;
        this.referencePoses = []; // Clear cached poses when switching dances
        
        // Update video source and wait for it to load
        this.referenceVideo.src = `public/${selectedDance}.mp4`;
        this.referenceVideo.load(); // Force reload
        
        this.statusEl.textContent = `Switched to ${selectedDance}. Ready to start.`;
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

            // Try to load saved poses from database first
            if (this.referencePoses.length === 0) {
                this.statusEl.textContent = 'Loading pose data from database...';
                const savedPoses = await this.loadPosesFromDatabase(this.currentDanceName);
                if (savedPoses && savedPoses.length > 0) {
                    this.referencePoses = savedPoses;
                    this.movementComparer.setReferencePoses(this.referencePoses);
                    this.statusEl.textContent = `✅ Loaded ${this.referencePoses.length} poses from database - Ready!`;
                } else {
                    // Analyze reference video if not in database
                    this.statusEl.textContent = 'Analyzing reference dance (this only happens once)...';
                    try {
                        await this.analyzeReferenceVideo();
                        if (this.referencePoses.length === 0) {
                            throw new Error('No poses detected in reference video. Make sure the video contains a visible person.');
                        }
                        // Save the analyzed poses to database
                        await this.savePosesToDatabase(this.currentDanceName, this.referencePoses);
                        this.statusEl.textContent = `✅ Analyzed and saved ${this.referencePoses.length} poses to database!`;
                    } catch (error) {
                        console.error('Error analyzing reference video:', error);
                        this.statusEl.textContent = 'Error analyzing video: ' + error.message;
                        this.startBtn.disabled = false;
                        return;
                    }
                }
            }

            // Wait for video to be ready before playing
            await new Promise((resolve) => {
                if (this.referenceVideo.readyState >= 2) {
                    resolve();
                } else {
                    this.referenceVideo.addEventListener('loadeddata', resolve, { once: true });
                    this.referenceVideo.load(); // Force load if not already loading
                }
            });
            
            this.statusEl.textContent = 'Dance battle started! Follow the moves!';
            this.isRunning = true;
            this.stopBtn.disabled = false;
            
            // Play video with error handling
            try {
                await this.referenceVideo.play();
            } catch (playError) {
                console.error('Error playing video:', playError);
                this.statusEl.textContent = 'Error: Could not play video. Please click the video to enable playback.';
            }

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
            // Detect pose in camera
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

            // Continue loop - increased FPS for smoother tracking
            setTimeout(() => this.startComparisonLoop(), 16); // ~60 fps
        } catch (error) {
            console.error('Error in comparison loop:', error);
            this.statusEl.textContent = 'Error during comparison: ' + error.message;
        }
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

    async loadPosesFromDatabase(danceName) {
        try {
            const response = await fetch(`${this.API_BASE}/poses/${danceName}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                console.error('Database API error:', data.message || data.error);
                // Fallback: try to load from local JSON file if database fails
                return await this.loadPosesFromJSON(danceName);
            }
            
            if (data.success && data.poses) {
                console.log(`✅ Loaded ${data.poses.length} poses from database for ${danceName}`);
                return data.poses;
            } else {
                console.log(`No poses found in database for ${danceName}, trying JSON fallback...`);
                // Fallback: try to load from local JSON file
                return await this.loadPosesFromJSON(danceName);
            }
        } catch (error) {
            console.error('Error loading poses from database:', error);
            console.log('Falling back to JSON file...');
            // Fallback: try to load from local JSON file
            return await this.loadPosesFromJSON(danceName);
        }
    }

    async loadPosesFromJSON(danceName) {
        try {
            const response = await fetch(`${danceName}.json`);
            if (!response.ok) {
                return null;
            }
            const poses = await response.json();
            console.log(`📄 Loaded ${poses.length} poses from ${danceName}.json`);
            // Save to database for next time
            await this.savePosesToDatabase(danceName, poses);
            return poses;
        } catch (error) {
            console.error('Error loading from JSON:', error);
            return null;
        }
    }

    async savePosesToDatabase(danceName, poses) {
        try {
            const response = await fetch(`${this.API_BASE}/poses/${danceName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ poses })
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log(`✅ Saved ${data.frameCount} poses to database for ${danceName}`);
                return true;
            } else {
                console.error('Failed to save poses:', data.error);
                return false;
            }
        } catch (error) {
            console.error('Error saving poses to database:', error);
            return false;
        }
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

