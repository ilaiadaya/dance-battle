class DanceBattleApp2Player {
    constructor() {
        this.poseDetector = new PoseDetector();
        this.movementComparer = new MovementComparer();
        
        // Player 1 elements
        this.referenceVideo1 = document.getElementById('referenceVideo1');
        this.cameraVideo1 = document.getElementById('cameraVideo1');
        this.referenceCanvas1 = document.getElementById('referenceCanvas1');
        this.cameraCanvas1 = document.getElementById('cameraCanvas1');
        this.scoreEl1 = document.getElementById('score1');
        
        // Player 2 elements
        this.referenceVideo2 = document.getElementById('referenceVideo2');
        this.cameraVideo2 = document.getElementById('cameraVideo2');
        this.referenceCanvas2 = document.getElementById('referenceCanvas2');
        this.cameraCanvas2 = document.getElementById('cameraCanvas2');
        this.scoreEl2 = document.getElementById('score2');
        
        // Control elements
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.statusEl = document.getElementById('status');
        this.countdownOverlay = document.getElementById('countdownOverlay');
        this.countdownNumber = document.getElementById('countdownNumber');
        
        // State
        this.isRunning = false;
        this.camera1 = null;
        this.camera2 = null;
        this.referencePoses1 = [];
        this.referencePoses2 = [];
        this.score1 = 0;
        this.score2 = 0;
        this.startTime = null;
        
        // Colors for each player
        this.player1Colors = { line: '#00FF00', dot: '#FF0000' }; // Green/Red
        this.player2Colors = { line: '#00FFFF', dot: '#FF00FF' }; // Cyan/Magenta
        
        // API base URL
        this.API_BASE = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000/api' 
            : '/api';
        
        this.setupEventListeners();
        this.requestCameraPermission();
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
    }

    async requestCameraPermission() {
        try {
            this.statusEl.textContent = 'Please allow camera access for both players...';
            
            // Request camera for player 1
            const stream1 = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });
            this.cameraVideo1.srcObject = stream1;
            this.camera1 = stream1;
            
            // Request camera for player 2 (try to get a different device if available)
            const stream2 = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });
            this.cameraVideo2.srcObject = stream2;
            this.camera2 = stream2;
            
            this.statusEl.textContent = 'Camera access granted! Ready to start.';
        } catch (error) {
            console.error('Camera permission denied:', error);
            this.statusEl.textContent = 'Camera access is required. Please allow camera access and refresh the page.';
        }
    }

    async waitForTwoPlayersDetection() {
        // Check both camera feeds for full body detection
        const video1 = this.cameraVideo1;
        const video2 = this.cameraVideo2;
        
        if (!video1 || !video1.srcObject || !video2 || !video2.srcObject) {
            throw new Error('Cameras not available. Please grant camera access.');
        }
        
        // Make sure videos are playing
        if (video1.paused) video1.play();
        if (video2.paused) video2.play();
        
        const checkInterval = 200; // Check every 200ms
        const requiredConsecutiveDetections = 5; // Need 5 consecutive frames (1 second)
        
        let consecutiveDetections1 = 0;
        let consecutiveDetections2 = 0;
        
        return new Promise((resolve) => {
            const checkFrame = async () => {
                try {
                    // Check player 1
                    const results1 = await this.poseDetector.detectPoseOnly(video1);
                    const landmarks1 = this.poseDetector.getPoseLandmarks(results1);
                    const hasFullBody1 = landmarks1 && 
                        this.movementComparer.hasFullBody(landmarks1) &&
                        this.movementComparer.hasGoodLighting(landmarks1);
                    
                    if (hasFullBody1) {
                        consecutiveDetections1++;
                    } else {
                        consecutiveDetections1 = 0;
                    }
                    
                    // Check player 2
                    const results2 = await this.poseDetector.detectPoseOnly(video2);
                    const landmarks2 = this.poseDetector.getPoseLandmarks(results2);
                    const hasFullBody2 = landmarks2 && 
                        this.movementComparer.hasFullBody(landmarks2) &&
                        this.movementComparer.hasGoodLighting(landmarks2);
                    
                    if (hasFullBody2) {
                        consecutiveDetections2++;
                    } else {
                        consecutiveDetections2 = 0;
                    }
                    
                    // Update status
                    if (consecutiveDetections1 === 0 && consecutiveDetections2 === 0) {
                        this.statusEl.textContent = 'Please step back so both players\' full bodies (head to feet) are visible with good lighting...';
                    } else if (consecutiveDetections1 === 0) {
                        this.statusEl.textContent = 'Player 1: Please step back so your full body is visible...';
                    } else if (consecutiveDetections2 === 0) {
                        this.statusEl.textContent = 'Player 2: Please step back so your full body is visible...';
                    } else {
                        const progress1 = Math.min(consecutiveDetections1 / requiredConsecutiveDetections * 100, 100);
                        const progress2 = Math.min(consecutiveDetections2 / requiredConsecutiveDetections * 100, 100);
                        this.statusEl.textContent = `Detecting players... Player 1: ${Math.floor(progress1)}%, Player 2: ${Math.floor(progress2)}%`;
                    }
                    
                    // If both have enough consecutive detections, we're good
                    if (consecutiveDetections1 >= requiredConsecutiveDetections && 
                        consecutiveDetections2 >= requiredConsecutiveDetections) {
                        resolve(); // Both players detected, ready to start
                        return;
                    }
                } catch (error) {
                    console.error('Error detecting poses:', error);
                    consecutiveDetections1 = 0;
                    consecutiveDetections2 = 0;
                    this.statusEl.textContent = 'Please step back so both players\' full bodies (head to feet) are visible with good lighting...';
                }
                
                // Continue checking indefinitely until both are detected
                setTimeout(checkFrame, checkInterval);
            };
            
            // Start checking
            checkFrame();
        });
    }

    async loadPosesFromDatabase(danceName) {
        try {
            const response = await fetch(`${this.API_BASE}/poses/${danceName}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data.poses || [];
        } catch (error) {
            console.error(`Error loading poses from database for ${danceName}:`, error);
            return null;
        }
    }

    async analyzeReferenceVideo(video, danceName) {
        return new Promise((resolve, reject) => {
            const poses = [];
            
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
                const fps = 60;
                const frameInterval = 1 / fps;
                const maxDuration = video.duration;
                let frameCount = 0;
                const totalFrames = Math.ceil(maxDuration * fps);
                
                const analysisCanvas = document.createElement('canvas');
                analysisCanvas.width = video.videoWidth || 640;
                analysisCanvas.height = video.videoHeight || 480;
                const analysisCtx = analysisCanvas.getContext('2d');
                
                const analyzeNextFrame = async () => {
                    const currentTime = video.currentTime;
                    
                    if (currentTime >= maxDuration - 0.1) {
                        resolve(poses);
                        return;
                    }

                    try {
                        analysisCtx.drawImage(video, 0, 0, analysisCanvas.width, analysisCanvas.height);
                        
                        // Single person detection
                        const results = await this.poseDetector.detectPoseOnly(analysisCanvas);
                        const landmarks = this.poseDetector.getPoseLandmarks(results);
                        
                        if (landmarks) {
                            poses.push(landmarks);
                        }

                        frameCount++;
                        const progress = Math.min(Math.floor((frameCount / totalFrames) * 100), 100);
                        this.statusEl.textContent = `Analyzing ${danceName}... ${progress}%`;

                        const nextTime = Math.min(currentTime + frameInterval, maxDuration);
                        video.currentTime = nextTime;
                        
                        await new Promise(seekResolve => {
                            const onSeeked = () => {
                                video.removeEventListener('seeked', onSeeked);
                                seekResolve();
                            };
                            video.addEventListener('seeked', onSeeked, { once: true });
                            setTimeout(() => {
                                video.removeEventListener('seeked', onSeeked);
                                seekResolve();
                            }, 100);
                        });
                        
                        await new Promise(resolve => setTimeout(resolve, 10));
                        analyzeNextFrame();
                    } catch (error) {
                        console.error('Error analyzing frame:', error);
                        video.currentTime = Math.min(currentTime + frameInterval, maxDuration);
                        await new Promise(resolve => setTimeout(resolve, 50));
                        analyzeNextFrame();
                    }
                };

                await new Promise(resolve => {
                    const onSeeked = () => {
                        video.removeEventListener('seeked', onSeeked);
                        setTimeout(resolve, 100);
                    };
                    video.addEventListener('seeked', onSeeked, { once: true });
                });

                analyzeNextFrame();
            };

            waitForVideo();
        });
    }

    drawStoredLandmarksWithColor(landmarks, canvasElement, lineColor, dotColor) {
        if (!landmarks) return;
        
        const ctx = canvasElement.getContext('2d');
        ctx.save();
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        if (canvasElement.width !== canvasElement.offsetWidth || 
            canvasElement.height !== canvasElement.offsetHeight) {
            canvasElement.width = canvasElement.offsetWidth;
            canvasElement.height = canvasElement.offsetHeight;
        }

        // Use custom drawing with specified colors
        this.poseDetector.drawConnections(ctx, landmarks, POSE_CONNECTIONS, lineColor);
        this.poseDetector.drawLandmarks(ctx, landmarks, dotColor);

        ctx.restore();
    }

    async showCountdown() {
        this.countdownOverlay.classList.add('active');
        let count = 3;
        this.countdownNumber.textContent = count;

        return new Promise(resolve => {
            const countdownInterval = setInterval(() => {
                count--;
                if (count > 0) {
                    this.countdownNumber.textContent = count;
                } else if (count === 0) {
                    this.countdownNumber.textContent = 'GO!';
                } else {
                    this.countdownOverlay.classList.remove('active');
                    clearInterval(countdownInterval);
                    resolve();
                }
            }, 1000);
        });
    }

    async start() {
        if (this.isRunning) return;

        this.statusEl.textContent = 'Initializing...';
        this.startBtn.disabled = true;

        try {
            // Load or analyze reference videos
            this.statusEl.textContent = 'Loading reference videos...';
            
            // Try to load poses from database
            const poses1 = await this.loadPosesFromDatabase('demo2');
            const poses2 = await this.loadPosesFromDatabase('demo3');
            
            if (poses1 && poses1.length > 0) {
                this.referencePoses1 = poses1;
                this.statusEl.textContent = `✅ Loaded ${poses1.length} poses from database for demo2`;
            } else {
                this.statusEl.textContent = 'Analyzing demo2.mp4 (this only happens once)...';
                this.referencePoses1 = await this.analyzeReferenceVideo(this.referenceVideo1, 'demo2');
            }
            
            if (poses2 && poses2.length > 0) {
                this.referencePoses2 = poses2;
                this.statusEl.textContent = `✅ Loaded ${poses2.length} poses from database for demo3`;
            } else {
                this.statusEl.textContent = 'Analyzing demo3.mp4 (this only happens once)...';
                this.referencePoses2 = await this.analyzeReferenceVideo(this.referenceVideo2, 'demo3');
            }
            
            // Wait for videos to be ready
            await Promise.all([
                new Promise((resolve) => {
                    if (this.referenceVideo1.readyState >= 2) resolve();
                    else this.referenceVideo1.addEventListener('loadeddata', resolve, { once: true });
                }),
                new Promise((resolve) => {
                    if (this.referenceVideo2.readyState >= 2) resolve();
                    else this.referenceVideo2.addEventListener('loadeddata', resolve, { once: true });
                })
            ]);
            
            // Wait for 2 players to be detected
            this.statusEl.textContent = 'Detecting both players...';
            await this.waitForTwoPlayersDetection();
            this.statusEl.textContent = 'Both players detected!';
            
            // Show countdown
            await this.showCountdown();
            
            this.statusEl.textContent = 'Dance battle started! Follow the moves!';
            this.isRunning = true;
            this.stopBtn.disabled = false;
            this.startTime = Date.now();
            this.score1 = 0;
            this.score2 = 0;
            
            // Play videos
            await Promise.all([
                this.referenceVideo1.play(),
                this.referenceVideo2.play()
            ]);
            
            // Start overlay and comparison loops
            this.startReferenceOverlayLoop();
            this.startComparisonLoop();
        } catch (error) {
            console.error('Error starting app:', error);
            this.statusEl.textContent = 'Error: ' + error.message;
            this.startBtn.disabled = false;
        }
    }

    startReferenceOverlayLoop() {
        if (!this.isRunning) return;

        // Player 1 overlay
        const videoTime1 = this.referenceVideo1.currentTime;
        const videoDuration1 = this.referenceVideo1.duration;
        if (this.referencePoses1.length > 0 && videoDuration1 > 0) {
            const frameIndex1 = Math.min(
                Math.floor((videoTime1 / videoDuration1) * this.referencePoses1.length),
                this.referencePoses1.length - 1
            );
            const landmarks1 = this.referencePoses1[frameIndex1];
            if (landmarks1) {
                this.drawStoredLandmarksWithColor(
                    landmarks1, 
                    this.referenceCanvas1, 
                    this.player1Colors.line, 
                    this.player1Colors.dot
                );
            }
        }

        // Player 2 overlay
        const videoTime2 = this.referenceVideo2.currentTime;
        const videoDuration2 = this.referenceVideo2.duration;
        if (this.referencePoses2.length > 0 && videoDuration2 > 0) {
            const frameIndex2 = Math.min(
                Math.floor((videoTime2 / videoDuration2) * this.referencePoses2.length),
                this.referencePoses2.length - 1
            );
            const landmarks2 = this.referencePoses2[frameIndex2];
            if (landmarks2) {
                this.drawStoredLandmarksWithColor(
                    landmarks2, 
                    this.referenceCanvas2, 
                    this.player2Colors.line, 
                    this.player2Colors.dot
                );
            }
        }

        requestAnimationFrame(() => this.startReferenceOverlayLoop());
    }

    async startComparisonLoop() {
        if (!this.isRunning) return;

        try {
            // Detect poses for both players
            const [results1, results2] = await Promise.all([
                this.poseDetector.detectPose(this.cameraVideo1, this.cameraCanvas1),
                this.poseDetector.detectPose(this.cameraVideo2, this.cameraCanvas2)
            ]);
            
            const landmarks1 = this.poseDetector.getPoseLandmarks(results1);
            const landmarks2 = this.poseDetector.getPoseLandmarks(results2);
            
            // Draw with player-specific colors
            if (landmarks1) {
                const ctx1 = this.cameraCanvas1.getContext('2d');
                ctx1.save();
                ctx1.clearRect(0, 0, this.cameraCanvas1.width, this.cameraCanvas1.height);
                if (this.cameraCanvas1.width !== this.cameraCanvas1.offsetWidth || 
                    this.cameraCanvas1.height !== this.cameraCanvas1.offsetHeight) {
                    this.cameraCanvas1.width = this.cameraCanvas1.offsetWidth;
                    this.cameraCanvas1.height = this.cameraCanvas1.offsetHeight;
                }
                this.poseDetector.drawConnections(ctx1, landmarks1, POSE_CONNECTIONS, this.player1Colors.line);
                this.poseDetector.drawLandmarks(ctx1, landmarks1, this.player1Colors.dot);
                ctx1.restore();
            }
            
            if (landmarks2) {
                const ctx2 = this.cameraCanvas2.getContext('2d');
                ctx2.save();
                ctx2.clearRect(0, 0, this.cameraCanvas2.width, this.cameraCanvas2.height);
                if (this.cameraCanvas2.width !== this.cameraCanvas2.offsetWidth || 
                    this.cameraCanvas2.height !== this.cameraCanvas2.offsetHeight) {
                    this.cameraCanvas2.width = this.cameraCanvas2.offsetWidth;
                    this.cameraCanvas2.height = this.cameraCanvas2.offsetHeight;
                }
                this.poseDetector.drawConnections(ctx2, landmarks2, POSE_CONNECTIONS, this.player2Colors.line);
                this.poseDetector.drawLandmarks(ctx2, landmarks2, this.player2Colors.dot);
                ctx2.restore();
            }
            
            // Compare player 1
            if (landmarks1 && this.referencePoses1.length > 0) {
                const videoTime1 = this.referenceVideo1.currentTime;
                const videoDuration1 = this.referenceVideo1.duration;
                if (videoDuration1 > 0) {
                    const frameIndex1 = Math.min(
                        Math.floor((videoTime1 / videoDuration1) * this.referencePoses1.length),
                        this.referencePoses1.length - 1
                    );
                    const refLandmarks1 = this.referencePoses1[frameIndex1];
                    
                    if (refLandmarks1) {
                        const prevFrameIndex1 = frameIndex1 > 0 ? frameIndex1 - 1 : 0;
                        const prevLandmarks1 = this.referencePoses1[prevFrameIndex1];
                        
                        const hasMovement1 = this.movementComparer.hasSignificantMovement(
                            prevLandmarks1, 
                            refLandmarks1
                        );
                        
                        if (hasMovement1) {
                            const similarity1 = this.movementComparer.comparePoses(landmarks1, refLandmarks1);
                            const points1 = Math.floor(similarity1 * 10);
                            if (points1 > 0) {
                                this.score1 += points1;
                                this.scoreEl1.textContent = Math.floor(this.score1);
                            }
                        }
                    }
                }
            }
            
            // Compare player 2
            if (landmarks2 && this.referencePoses2.length > 0) {
                const videoTime2 = this.referenceVideo2.currentTime;
                const videoDuration2 = this.referenceVideo2.duration;
                if (videoDuration2 > 0) {
                    const frameIndex2 = Math.min(
                        Math.floor((videoTime2 / videoDuration2) * this.referencePoses2.length),
                        this.referencePoses2.length - 1
                    );
                    const refLandmarks2 = this.referencePoses2[frameIndex2];
                    
                    if (refLandmarks2) {
                        const prevFrameIndex2 = frameIndex2 > 0 ? frameIndex2 - 1 : 0;
                        const prevLandmarks2 = this.referencePoses2[prevFrameIndex2];
                        
                        const hasMovement2 = this.movementComparer.hasSignificantMovement(
                            prevLandmarks2, 
                            refLandmarks2
                        );
                        
                        if (hasMovement2) {
                            const similarity2 = this.movementComparer.comparePoses(landmarks2, refLandmarks2);
                            const points2 = Math.floor(similarity2 * 10);
                            if (points2 > 0) {
                                this.score2 += points2;
                                this.scoreEl2.textContent = Math.floor(this.score2);
                            }
                        }
                    }
                }
            }
            
            setTimeout(() => this.startComparisonLoop(), 16); // ~60 fps
        } catch (error) {
            console.error('Error in comparison loop:', error);
        }
    }

    stop() {
        this.isRunning = false;
        
        // Stop and reset videos
        this.referenceVideo1.pause();
        this.referenceVideo1.currentTime = 0;
        this.referenceVideo2.pause();
        this.referenceVideo2.currentTime = 0;
        
        // Stop cameras
        if (this.camera1) {
            this.camera1.getTracks().forEach(track => track.stop());
            this.camera1 = null;
        }
        if (this.camera2) {
            this.camera2.getTracks().forEach(track => track.stop());
            this.camera2 = null;
        }
        this.cameraVideo1.srcObject = null;
        this.cameraVideo2.srcObject = null;
        
        // Clear canvases
        [this.referenceCanvas1, this.cameraCanvas1, this.referenceCanvas2, this.cameraCanvas2].forEach(canvas => {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        });
        
        // Reset scores
        this.score1 = 0;
        this.score2 = 0;
        this.scoreEl1.textContent = '0';
        this.scoreEl2.textContent = '0';
        
        this.statusEl.textContent = 'Stopped. Everything cleared. Ready to start again.';
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new DanceBattleApp2Player();
});

