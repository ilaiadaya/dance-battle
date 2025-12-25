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
        this.videoProgressBar = document.getElementById('videoProgressBar');
        this.countdownOverlay = document.getElementById('countdownOverlay');
        this.countdownNumber = document.getElementById('countdownNumber');
        this.scorePopup = document.getElementById('scorePopup');
        this.scorePopupValue = document.getElementById('scorePopupValue');
        this.confettiContainer = document.getElementById('confettiContainer');
        this.mainContent = document.querySelector('.main-content');
        
        this.isRunning = false;
        this.camera = null;
        this.referencePoses = [];
        this.referencePoseTimestamps = []; // Store timestamps for interpolation
        this.isAnalyzingReference = false;
        this.lastSimilarity = 0;
        this.currentDanceName = 'danceone';
        this.cameraPermissionGranted = false;
        this.startTime = null;
        this.hasWon = false;
        this.consecutiveGoodMatches = 0; // Track consecutive good matches for confetti
        
        // API base URL - use relative URL in production, absolute in development
        this.API_BASE = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000/api' 
            : '/api';
        
        this.setupEventListeners();
        this.setupScoreManager();
        
        // Request camera permission early
        this.requestCameraPermission();
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.danceSelect.addEventListener('change', () => this.onDanceChange());
    }

    async requestCameraPermission() {
        try {
            this.statusEl.textContent = 'Please allow camera access to continue...';
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });
            
            // Show the camera feed immediately
            this.cameraVideo.srcObject = stream;
            this.camera = stream;
            this.cameraPermissionGranted = true;
            this.statusEl.textContent = 'Camera access granted! Ready to start.';
        } catch (error) {
            console.error('Camera permission denied:', error);
            this.cameraPermissionGranted = false;
            this.statusEl.textContent = 'Camera access is required. Please allow camera access and refresh the page.';
        }
    }

    onDanceChange() {
        const selectedDance = this.danceSelect.value;
        
        // Handle "coming soon" option
        if (selectedDance === 'coming-soon') {
            this.statusEl.textContent = 'More dances coming soon! Stay tuned! 🎵';
            // Reset to danceone
            this.danceSelect.value = 'danceone';
            this.currentDanceName = 'danceone';
            return;
        }
        
        this.currentDanceName = selectedDance;
        this.referencePoses = []; // Clear cached poses when switching dances
        this.referencePoseTimestamps = []; // Clear timestamps too
        
        // Update video source and wait for it to load
        this.referenceVideo.src = `public/${selectedDance}.mp4`;
        this.referenceVideo.load(); // Force reload
        
        // Reset progress bar
        if (this.videoProgressBar) {
            this.videoProgressBar.style.width = '0%';
        }
        
        this.statusEl.textContent = `Switched to ${selectedDance}. Ready to start.`;
    }

    async waitForFullBodyDetection() {
        // Thoroughly check multiple frames to ensure we have a stable full body detection
        const video = this.referenceVideo;
        const checkInterval = 0.2; // Check every 0.2 seconds for more thorough scanning
        const maxChecks = 30; // Check up to 6 seconds of video
        const requiredConsecutiveDetections = 3; // Need 3 consecutive frames with full body
        
        let consecutiveDetections = 0;
        let lastDetectionTime = null;
        
        for (let i = 0; i < maxChecks; i++) {
            const checkTime = i * checkInterval;
            video.currentTime = checkTime;
            
            // Wait for video to seek
            await new Promise((resolve) => {
                const onSeeked = () => {
                    video.removeEventListener('seeked', onSeeked);
                    setTimeout(resolve, 150); // Give it time to render
                };
                video.addEventListener('seeked', onSeeked, { once: true });
                
                // Timeout fallback
                setTimeout(() => {
                    video.removeEventListener('seeked', onSeeked);
                    resolve();
                }, 500);
            });
            
            // Detect pose in current frame
            try {
                const results = await this.poseDetector.detectPoseOnly(video);
                const landmarks = this.poseDetector.getPoseLandmarks(results);
                
                if (landmarks && this.movementComparer.hasFullBody(landmarks)) {
                    // Check if this is consecutive with previous detection
                    if (lastDetectionTime !== null && checkTime - lastDetectionTime <= checkInterval * 1.5) {
                        consecutiveDetections++;
                    } else {
                        consecutiveDetections = 1; // Reset if not consecutive
                    }
                    lastDetectionTime = checkTime;
                    
                    // If we have enough consecutive detections, we're good
                    if (consecutiveDetections >= requiredConsecutiveDetections) {
                        // Found stable full body detection, reset video to start
                        video.currentTime = 0;
                        await new Promise((resolve) => {
                            const onSeeked = () => {
                                video.removeEventListener('seeked', onSeeked);
                                resolve();
                            };
                            video.addEventListener('seeked', onSeeked, { once: true });
                        });
                        return; // Full body detected, ready to start
                    }
                } else {
                    // Reset consecutive counter if no full body detected
                    consecutiveDetections = 0;
                    lastDetectionTime = null;
                }
            } catch (error) {
                console.error('Error detecting pose in frame:', error);
                consecutiveDetections = 0;
            }
        }
        
        // If we didn't find stable full body detection, show error and don't start
        video.currentTime = 0;
        await new Promise((resolve) => {
            const onSeeked = () => {
                video.removeEventListener('seeked', onSeeked);
                resolve();
            };
            video.addEventListener('seeked', onSeeked, { once: true });
        });
        
        throw new Error('Could not detect a stable full body in the reference video. Please ensure the dancer is clearly visible with full body in frame.');
    }

    setupVideoListeners() {
        // Update progress bar as video plays
        this.referenceVideo.addEventListener('timeupdate', () => {
            if (this.referenceVideo.duration) {
                const progress = (this.referenceVideo.currentTime / this.referenceVideo.duration) * 100;
                if (this.videoProgressBar) {
                    this.videoProgressBar.style.width = `${progress}%`;
                }
            }
        });

        // Stop when video ends (don't loop)
        this.referenceVideo.addEventListener('ended', () => {
            if (this.isRunning) {
                this.statusEl.textContent = 'Video finished! Great job!';
            }
        });
    }

    setupScoreManager() {
        this.scoreManager.onScoreUpdate = (score, target) => {
            this.scoreEl.textContent = Math.floor(score);
            this.targetEl.textContent = target;
        };

        this.scoreManager.onWin = () => {
            if (!this.hasWon) {
                this.hasWon = true;
                const timeTaken = (Date.now() - this.startTime) / 1000;
                this.statusEl.textContent = `🎉 WOW ${timeTaken.toFixed(1)} seconds! Keep going! 🎉`;
            }
        };
    }

    async start() {
        if (this.isRunning) return;

        this.statusEl.textContent = 'Initializing camera...';
        this.startBtn.disabled = true;

        try {
            // Initialize pose detector
            await this.poseDetector.initialize();

            // Start camera (if not already started from permission request)
            if (!this.camera || !this.camera.active) {
                await this.startCamera();
            }

            // Try to load saved poses from database first
            if (this.referencePoses.length === 0) {
                this.statusEl.textContent = 'Loading pose data from database...';
                const savedPoses = await this.loadPosesFromDatabase(this.currentDanceName);
                if (savedPoses && savedPoses.length > 0) {
                    this.referencePoses = savedPoses;
                    // Regenerate timestamps based on actual video duration and frame count
                    // This ensures proper synchronization regardless of original analysis FPS
                    await new Promise((resolve) => {
                        if (this.referenceVideo.readyState >= 2 && this.referenceVideo.duration) {
                            const videoDuration = this.referenceVideo.duration;
                            const frameInterval = videoDuration / savedPoses.length;
                            this.referencePoseTimestamps = savedPoses.map((_, index) => index * frameInterval);
                            resolve();
                        } else {
                            // Add error handler in case video fails to load
                            const errorHandler = () => {
                                console.warn('Video failed to load, using estimated timestamps');
                                // Use estimated duration based on pose count (assuming 60fps)
                                const estimatedDuration = savedPoses.length / 60;
                                const frameInterval = estimatedDuration / savedPoses.length;
                                this.referencePoseTimestamps = savedPoses.map((_, index) => index * frameInterval);
                                resolve();
                            };
                            
                            this.referenceVideo.addEventListener('error', errorHandler, { once: true });
                            
                            this.referenceVideo.addEventListener('loadedmetadata', () => {
                                const videoDuration = this.referenceVideo.duration;
                                if (videoDuration && videoDuration > 0) {
                                    const frameInterval = videoDuration / savedPoses.length;
                                    this.referencePoseTimestamps = savedPoses.map((_, index) => index * frameInterval);
                                    this.referenceVideo.removeEventListener('error', errorHandler);
                                    resolve();
                                } else {
                                    errorHandler();
                                }
                            }, { once: true });
                            
                            // Timeout fallback - if video doesn't load in 5 seconds, use estimated timestamps
                            setTimeout(() => {
                                if (!this.referencePoseTimestamps || this.referencePoseTimestamps.length === 0) {
                                    console.warn('Video metadata timeout, using estimated timestamps');
                                    const estimatedDuration = savedPoses.length / 60;
                                    const frameInterval = estimatedDuration / savedPoses.length;
                                    this.referencePoseTimestamps = savedPoses.map((_, index) => index * frameInterval);
                                    this.referenceVideo.removeEventListener('error', errorHandler);
                                    this.referenceVideo.removeEventListener('loadedmetadata', () => {});
                                    resolve();
                                }
                            }, 5000);
                        }
                    });
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
            
            // Wait for full body detection in reference video before starting
            this.statusEl.textContent = 'Detecting full body in video...';
            try {
                await this.waitForFullBodyDetection();
                this.statusEl.textContent = 'Full body detected!';
            } catch (error) {
                this.statusEl.textContent = error.message;
                this.startBtn.disabled = false;
                return;
            }
            
            // Show countdown: 3, 2, 1
            await this.showCountdown();
            
            // Change layout to battle mode (reference big on top, user small below) after countdown
            if (this.mainContent) {
                this.mainContent.classList.add('battle-mode');
            }
            
            this.statusEl.textContent = 'Dance battle started! Follow the moves!';
            this.isRunning = true;
            this.stopBtn.disabled = false;
            this.startTime = Date.now();
            this.hasWon = false;
            
            // Set up video event listeners
            this.setupVideoListeners();
            
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
                // Increased frame rate for smoother analysis - analyze at 60fps for better continuity
                const fps = 60; // Higher frame rate for smoother playback
                const frameInterval = 1 / fps;
                const maxDuration = video.duration;
                let frameCount = 0;
                const totalFrames = Math.ceil(maxDuration * fps);
                
                // Store poses with timestamps for accurate matching
                this.referencePoses = [];
                this.referencePoseTimestamps = []; // Store timestamps for each pose
                
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
                        // Save the analyzed poses to database
                        try {
                            await this.savePosesToDatabase(this.currentDanceName, this.referencePoses);
                            this.statusEl.textContent = `✅ Analyzed and saved ${this.referencePoses.length} frames to database!`;
                        } catch (error) {
                            console.error('Error saving poses:', error);
                            this.statusEl.textContent = `Analyzed ${this.referencePoses.length} frames (save failed, but ready to use)`;
                        }
                        resolve();
                        return;
                    }

                    // Draw current video frame to canvas
                    try {
                        analysisCtx.drawImage(video, 0, 0, analysisCanvas.width, analysisCanvas.height);
                        
                        // Check if this is a multi-person dance (wakwaka)
                        const isMultiPerson = this.currentDanceName === 'wakwaka';
                        
                        if (isMultiPerson) {
                            // Detect multiple poses
                            const multiplePoses = await this.poseDetector.detectMultiplePoses(analysisCanvas);
                            if (multiplePoses && multiplePoses.length > 0) {
                                this.referencePoses.push(multiplePoses);
                                this.referencePoseTimestamps.push(currentTime);
                            }
                        } else {
                            // Single person detection
                            const results = await this.poseDetector.detectPoseOnly(analysisCanvas);
                            const landmarks = this.poseDetector.getPoseLandmarks(results);
                            
                            if (landmarks) {
                                this.referencePoses.push(landmarks);
                                this.referencePoseTimestamps.push(currentTime);
                            }
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
                        await new Promise(resolve => setTimeout(resolve, 10)); // Reduced delay for faster analysis
                        
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

    // Interpolate between two poses for smooth transitions
    interpolatePoses(pose1, pose2, t) {
        if (!pose1 || !pose2) return pose1 || pose2;
        if (t <= 0) return pose1;
        if (t >= 1) return pose2;
        
        // Check if multi-person (array of arrays)
        const isMultiPerson1 = Array.isArray(pose1) && pose1.length > 0 && Array.isArray(pose1[0]);
        const isMultiPerson2 = Array.isArray(pose2) && pose2.length > 0 && Array.isArray(pose2[0]);
        
        if (isMultiPerson1 || isMultiPerson2) {
            // For multi-person, interpolate each person separately
            const maxPersons = Math.max(
                isMultiPerson1 ? pose1.length : 0,
                isMultiPerson2 ? pose2.length : 0
            );
            const interpolated = [];
            for (let i = 0; i < maxPersons; i++) {
                const p1 = isMultiPerson1 && pose1[i] ? pose1[i] : null;
                const p2 = isMultiPerson2 && pose2[i] ? pose2[i] : null;
                if (p1 && p2) {
                    interpolated.push(this.interpolateLandmarks(p1, p2, t));
                } else if (p1) {
                    interpolated.push(p1);
                } else if (p2) {
                    interpolated.push(p2);
                }
            }
            return interpolated.length > 0 ? interpolated : null;
        } else {
            // Single person interpolation
            return this.interpolateLandmarks(pose1, pose2, t);
        }
    }

    // Interpolate between two landmark arrays
    interpolateLandmarks(landmarks1, landmarks2, t) {
        if (!landmarks1 || !landmarks2) return landmarks1 || landmarks2;
        if (landmarks1.length !== landmarks2.length) return landmarks1;
        
        return landmarks1.map((lm1, i) => {
            const lm2 = landmarks2[i];
            if (!lm1 || !lm2) return lm1 || lm2;
            
            return {
                x: lm1.x + (lm2.x - lm1.x) * t,
                y: lm1.y + (lm2.y - lm1.y) * t,
                z: lm1.z + (lm2.z - lm1.z) * t,
                visibility: Math.max(lm1.visibility, lm2.visibility) // Use max visibility
            };
        });
    }

    startReferenceOverlayLoop() {
        if (!this.isRunning) return;

        // Use stored poses with simple, accurate frame calculation
        const videoTime = this.referenceVideo.currentTime;
        const videoDuration = this.referenceVideo.duration;
        
        if (this.referencePoses.length > 0 && videoDuration > 0) {
            // Calculate frame index - use floor to ensure we're at or before current time (never ahead)
            const frameIndex = Math.min(
                Math.floor((videoTime / videoDuration) * this.referencePoses.length),
                this.referencePoses.length - 1
            );
            
            const referenceLandmarks = this.referencePoses[frameIndex];
            
            if (referenceLandmarks) {
                // Check if multi-person (array of arrays) or single person
                const isMultiPerson = Array.isArray(referenceLandmarks) && 
                                      referenceLandmarks.length > 0 && 
                                      Array.isArray(referenceLandmarks[0]);
                
                if (isMultiPerson) {
                    // Multi-person: use different colors for each person
                    const colors = ['#00FF00', '#00FFFF', '#FF00FF', '#FFFF00'];
                    this.poseDetector.drawMultiplePoses(referenceLandmarks, this.referenceCanvas, colors);
                } else {
                    // Single person
                    this.poseDetector.drawStoredLandmarks(referenceLandmarks, this.referenceCanvas);
                }
            }
        }

        requestAnimationFrame(() => this.startReferenceOverlayLoop());
    }

    async startComparisonLoop() {
        if (!this.isRunning) return;

        try {
            const isMultiPerson = this.currentDanceName === 'wakwaka';
            
            // Detect pose(s) in camera
            let userPoses = [];
            if (isMultiPerson) {
                // Multi-person: detect multiple poses
                userPoses = await this.poseDetector.detectMultiplePoses(this.cameraVideo);
                // Draw multiple poses on camera canvas
                if (userPoses.length > 0) {
                    const colors = ['#00FF00', '#00FFFF', '#FF00FF', '#FFFF00'];
                    this.poseDetector.drawMultiplePoses(userPoses, this.cameraCanvas, colors);
                } else {
                    // Clear canvas if no poses detected
                    const ctx = this.cameraCanvas.getContext('2d');
                    ctx.clearRect(0, 0, this.cameraCanvas.width, this.cameraCanvas.height);
                }
            } else {
                // Single person: detect single pose
                const cameraResults = await this.poseDetector.detectPose(
                    this.cameraVideo, 
                    this.cameraCanvas
                );
                const userLandmarks = this.poseDetector.getPoseLandmarks(cameraResults);
                if (userLandmarks) {
                    userPoses = [userLandmarks];
                }
            }

            // Use stored poses for comparison - calculate frame index from video time
            const videoTime = this.referenceVideo.currentTime;
            const videoDuration = this.referenceVideo.duration;
            
            if (this.referencePoses.length > 0 && videoDuration > 0 && userPoses.length > 0) {
                // Calculate frame index - use simple floor to ensure we're never ahead
                const frameIndex = Math.min(
                    Math.floor((videoTime / videoDuration) * this.referencePoses.length),
                    this.referencePoses.length - 1
                );
                
                const referenceFramePoses = this.referencePoses[frameIndex];
                
                // Check if multi-person reference
                const isRefMultiPerson = Array.isArray(referenceFramePoses) && 
                                        referenceFramePoses.length > 0 && 
                                        Array.isArray(referenceFramePoses[0]);
                
                if (isRefMultiPerson) {
                    // Multi-person comparison: match each user to closest reference person
                    let totalPoints = 0;
                    let bestSimilarity = 0;
                    
                    // Get previous frame for movement detection
                    const prevFrameIndex = frameIndex > 0 ? frameIndex - 1 : 0;
                    const previousRefPoses = this.referencePoses[prevFrameIndex];
                    
                    // Check if any reference person is moving
                    const hasMovement = this.movementComparer.hasSignificantMovementMultiPerson(
                        previousRefPoses,
                        referenceFramePoses
                    );
                    
                    if (hasMovement) {
                        // Match each user pose to the closest reference pose
                        userPoses.forEach(userPose => {
                            let bestMatch = 0;
                            let bestRefPose = null;
                            
                            // Find closest reference person
                            referenceFramePoses.forEach(refPose => {
                                const similarity = this.movementComparer.comparePoses(userPose, refPose);
                                if (similarity > bestMatch) {
                                    bestMatch = similarity;
                                    bestRefPose = refPose;
                                }
                            });
                            
                            if (bestMatch > 0) {
                                const points = Math.floor(bestMatch * 10);
                                totalPoints += points;
                                if (bestMatch > bestSimilarity) {
                                    bestSimilarity = bestMatch;
                                }
                            }
                        });
                        
                        if (totalPoints > 0) {
                            this.scoreManager.addPoints(totalPoints);
                            this.showMatchFeedback(bestSimilarity);
                            this.lastSimilarity = bestSimilarity;
                        }
                    }
                } else {
                    // Single person comparison (original logic)
                    const referenceLandmarks = referenceFramePoses;
                    const userLandmarks = userPoses[0];
                    
                    if (userLandmarks && referenceLandmarks) {
                        // Get previous frame for movement detection
                        const prevFrameIndex = frameIndex > 0 ? frameIndex - 1 : 0;
                        const previousLandmarks = this.referencePoses[prevFrameIndex];
                        
                        // Only award points if there's significant movement in the reference video
                        const hasMovement = this.movementComparer.hasSignificantMovement(
                            previousLandmarks, 
                            referenceLandmarks
                        );
                        
                        if (hasMovement) {
                            const similarity = this.movementComparer.comparePoses(
                                userLandmarks, 
                                referenceLandmarks
                            );

                            // Show visual feedback for good matches
                            this.showMatchFeedback(similarity);

                            // Award points based on similarity
                            const points = Math.floor(similarity * 10);
                            if (points > 0) {
                                this.scoreManager.addPoints(points);
                            }
                            
                            this.lastSimilarity = similarity;
                        }
                    }
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
        
        // Stop and reset video
        this.referenceVideo.pause();
        this.referenceVideo.currentTime = 0;
        
        // Stop camera
        if (this.camera) {
            this.camera.getTracks().forEach(track => track.stop());
            this.camera = null;
        }
        this.cameraVideo.srcObject = null;
        
        // Clear canvases
        const refCtx = this.referenceCanvas.getContext('2d');
        const camCtx = this.cameraCanvas.getContext('2d');
        refCtx.clearRect(0, 0, this.referenceCanvas.width, this.referenceCanvas.height);
        camCtx.clearRect(0, 0, this.cameraCanvas.width, this.cameraCanvas.height);
        
        // Reset score and state
        this.scoreManager.reset();
        this.referencePoses = [];
        this.referencePoseTimestamps = [];
        this.movementComparer.setReferencePoses([]);
        this.lastSimilarity = 0;
        this.consecutiveGoodMatches = 0;
        this.startTime = null;
        this.hasWon = false;
        
        // Reset layout
        if (this.mainContent) {
            this.mainContent.classList.remove('battle-mode');
        }
        
        // Reset progress bar
        if (this.videoProgressBar) {
            this.videoProgressBar.style.width = '0%';
        }
        
        // Reset UI
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.statusEl.textContent = 'Stopped. Everything cleared. Ready to start again.';
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

    async showCountdown() {
        return new Promise((resolve) => {
            this.countdownOverlay.classList.add('active');
            let count = 3;
            this.countdownNumber.textContent = count;
            
            const countdownInterval = setInterval(() => {
                count--;
                if (count > 0) {
                    this.countdownNumber.textContent = count;
                    // Add pulse animation
                    this.countdownNumber.style.animation = 'none';
                    setTimeout(() => {
                        this.countdownNumber.style.animation = 'pulse 0.5s ease';
                    }, 10);
                } else {
                    this.countdownNumber.textContent = 'GO!';
                    setTimeout(() => {
                        this.countdownOverlay.classList.remove('active');
                        clearInterval(countdownInterval);
                        resolve();
                    }, 500);
                }
            }, 1000);
        });
    }

    showMatchFeedback(similarity) {
        // Show feedback for good matches (similarity > 0.7)
        if (similarity > 0.7) {
            // Increment consecutive good matches
            this.consecutiveGoodMatches++;
            
            // Show big pop-out green flash
            this.matchOverlay.classList.add('active', 'big-pop');
            setTimeout(() => {
                this.matchOverlay.classList.remove('active', 'big-pop');
            }, 600);
            
            // Show score popup
            this.showScorePopup();
            
            // Flash indicator for excellent matches (> 0.9)
            if (similarity > 0.9) {
                this.matchIndicator.classList.add('active', 'big-pop');
                setTimeout(() => {
                    this.matchIndicator.classList.remove('active', 'big-pop');
                }, 600);
            }
            
            // Show confetti for 3+ consecutive good matches
            if (this.consecutiveGoodMatches >= 3) {
                this.showConfetti();
            }
        } else {
            // Reset consecutive counter if match isn't good
            this.consecutiveGoodMatches = 0;
        }
    }

    showScorePopup() {
        const currentScore = Math.floor(this.scoreManager.score);
        this.scorePopupValue.textContent = currentScore;
        this.scorePopup.classList.add('active');
        
        setTimeout(() => {
            this.scorePopup.classList.remove('active');
        }, 1000);
    }

    showConfetti() {
        // Create confetti particles
        const colors = ['#00ff00', '#00ffff', '#ff00ff', '#ffff00', '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24'];
        const particleCount = 50;
        
        for (let i = 0; i < particleCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti-particle';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 0.5 + 's';
            confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
            this.confettiContainer.appendChild(confetti);
            
            setTimeout(() => {
                confetti.remove();
            }, 3000);
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

