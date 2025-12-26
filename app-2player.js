class DanceBattleApp2Player {
    constructor() {
        this.poseDetector = new PoseDetector();
        this.movementComparer = new MovementComparer();
        
        // Reference video elements
        this.referenceVideo1 = document.getElementById('referenceVideo1');
        this.referenceVideo2 = document.getElementById('referenceVideo2');
        this.referenceCanvas1 = document.getElementById('referenceCanvas1');
        this.referenceCanvas2 = document.getElementById('referenceCanvas2');
        
        // Single camera feed
        this.cameraVideo = document.getElementById('cameraVideo');
        this.cameraCanvas = document.getElementById('cameraCanvas');
        
        // Score elements
        this.scoreEl1 = document.getElementById('score1');
        this.scoreEl2 = document.getElementById('score2');
        this.combinedScoreEl = document.getElementById('combinedScore');
        this.finalScores = document.getElementById('finalScores');
        this.finalScore1 = document.getElementById('finalScore1');
        this.finalScore2 = document.getElementById('finalScore2');
        this.finalCombinedScore = document.getElementById('finalCombinedScore');
        
        // Control elements
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.statusEl = document.getElementById('status');
        this.countdownOverlay = document.getElementById('countdownOverlay');
        this.countdownNumber = document.getElementById('countdownNumber');
        
        // State
        this.isRunning = false;
        this.camera = null;
        this.referencePoses1 = [];
        this.referencePoses2 = [];
        this.score1 = 0;
        this.score2 = 0;
        this.startTime = null;
        this.player1Pose = null; // Track which detected pose is player 1
        this.player2Pose = null; // Track which detected pose is player 2
        
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
        
        // Show final scores when videos end
        this.referenceVideo1.addEventListener('ended', () => this.showFinalScores());
        this.referenceVideo2.addEventListener('ended', () => this.showFinalScores());
    }

    showFinalScores() {
        if (!this.isRunning) return;
        this.isRunning = false;
        this.finalScore1.textContent = Math.floor(this.score1);
        this.finalScore2.textContent = Math.floor(this.score2);
        this.finalCombinedScore.textContent = Math.floor(this.score1 + this.score2);
        this.finalScores.classList.add('show');
    }

    async requestCameraPermission() {
        try {
            this.statusEl.textContent = 'Please allow camera access...';
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });
            this.cameraVideo.srcObject = stream;
            this.camera = stream;
            this.statusEl.textContent = 'Camera access granted! Ready to start.';
        } catch (error) {
            console.error('Camera permission denied:', error);
            this.statusEl.textContent = 'Camera access is required. Please allow camera access and refresh the page.';
        }
    }

    async waitForTwoPlayersDetection() {
        const video = this.cameraVideo;
        
        if (!video || !video.srcObject) {
            throw new Error('Camera not available. Please grant camera access.');
        }
        
        if (video.paused) video.play();
        
        const checkInterval = 200;
        const requiredConsecutiveDetections = 5;
        
        let consecutiveDetections = 0;
        
        return new Promise((resolve) => {
            const checkFrame = async () => {
                try {
                    // Detect multiple poses
                    const multiplePoses = await this.poseDetector.detectMultiplePoses(video);
                    
                    // Filter to only full bodies
                    const fullBodyPoses = multiplePoses.filter(pose => 
                        pose && 
                        this.movementComparer.hasFullBody(pose) &&
                        this.movementComparer.hasGoodLighting(pose)
                    );
                    
                    if (fullBodyPoses.length >= 2) {
                        consecutiveDetections++;
                        
                        if (consecutiveDetections === 1) {
                            this.statusEl.textContent = 'Detecting both players...';
                        }
                        
                        if (consecutiveDetections >= requiredConsecutiveDetections) {
                            // Assign poses: left person = player 1, right person = player 2
                            this.assignPlayers(fullBodyPoses);
                            resolve();
                            return;
                        }
                    } else {
                        consecutiveDetections = 0;
                        if (fullBodyPoses.length === 0) {
                            this.statusEl.textContent = 'Please step back so both players\' full bodies (head to feet) are visible with good lighting...';
                        } else {
                            this.statusEl.textContent = `Detected ${fullBodyPoses.length} player(s). Need 2 players...`;
                        }
                    }
                } catch (error) {
                    console.error('Error detecting poses:', error);
                    consecutiveDetections = 0;
                    this.statusEl.textContent = 'Please step back so both players\' full bodies (head to feet) are visible with good lighting...';
                }
                
                setTimeout(checkFrame, checkInterval);
            };
            
            checkFrame();
        });
    }

    assignPlayers(poses) {
        // Assign based on horizontal position: left = player 1, right = player 2
        if (poses.length >= 2) {
            // Get center x coordinate of each pose (using shoulders)
            const getCenterX = (pose) => {
                if (pose[11] && pose[12]) { // Left and right shoulders
                    return (pose[11].x + pose[12].x) / 2;
                }
                return 0.5; // Default to center if shoulders not detected
            };
            
            const sortedPoses = poses.slice().sort((a, b) => {
                return getCenterX(a) - getCenterX(b);
            });
            
            this.player1Pose = sortedPoses[0]; // Left person
            this.player2Pose = sortedPoses[1]; // Right person
        }
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

        const connections = typeof POSE_CONNECTIONS !== 'undefined' ? POSE_CONNECTIONS : [];
        this.poseDetector.drawConnections(ctx, landmarks, connections, lineColor);
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
        this.finalScores.classList.remove('show');

        try {
            // Load or analyze reference videos
            this.statusEl.textContent = 'Loading reference videos...';
            
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
            this.scoreEl1.textContent = '0';
            this.scoreEl2.textContent = '0';
            this.combinedScoreEl.textContent = '0';
            
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
            // Detect multiple poses in camera
            const multiplePoses = await this.poseDetector.detectMultiplePoses(this.cameraVideo);
            
            const ctx = this.cameraCanvas.getContext('2d');
            ctx.save();
            ctx.clearRect(0, 0, this.cameraCanvas.width, this.cameraCanvas.height);
            
            if (this.cameraCanvas.width !== this.cameraCanvas.offsetWidth || 
                this.cameraCanvas.height !== this.cameraCanvas.offsetHeight) {
                this.cameraCanvas.width = this.cameraCanvas.offsetWidth;
                this.cameraCanvas.height = this.cameraCanvas.offsetHeight;
            }
            
            // Draw all detected poses with their assigned colors
            if (multiplePoses.length >= 2) {
                // Reassign players based on current positions
                this.assignPlayers(multiplePoses);
                
                // Draw player 1 (left) with player 1 colors
                if (this.player1Pose) {
                    const connections = typeof POSE_CONNECTIONS !== 'undefined' ? POSE_CONNECTIONS : [];
                    this.poseDetector.drawConnections(ctx, this.player1Pose, connections, this.player1Colors.line);
                    this.poseDetector.drawLandmarks(ctx, this.player1Pose, this.player1Colors.dot);
                }
                
                // Draw player 2 (right) with player 2 colors
                if (this.player2Pose) {
                    const connections = typeof POSE_CONNECTIONS !== 'undefined' ? POSE_CONNECTIONS : [];
                    this.poseDetector.drawConnections(ctx, this.player2Pose, connections, this.player2Colors.line);
                    this.poseDetector.drawLandmarks(ctx, this.player2Pose, this.player2Colors.dot);
                }
            } else if (multiplePoses.length === 1) {
                // Only one person detected - draw with player 1 color
                const connections = typeof POSE_CONNECTIONS !== 'undefined' ? POSE_CONNECTIONS : [];
                this.poseDetector.drawConnections(ctx, multiplePoses[0], connections, this.player1Colors.line);
                this.poseDetector.drawLandmarks(ctx, multiplePoses[0], this.player1Colors.dot);
            }
            
            ctx.restore();
            
            // Compare player 1
            if (this.player1Pose && this.referencePoses1.length > 0) {
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
                            const similarity1 = this.movementComparer.comparePoses(this.player1Pose, refLandmarks1);
                            const points1 = Math.floor(similarity1 * 10);
                            if (points1 > 0) {
                                this.score1 += points1;
                                this.scoreEl1.textContent = Math.floor(this.score1);
                                this.updateCombinedScore();
                            }
                        }
                    }
                }
            }
            
            // Compare player 2
            if (this.player2Pose && this.referencePoses2.length > 0) {
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
                            const similarity2 = this.movementComparer.comparePoses(this.player2Pose, refLandmarks2);
                            const points2 = Math.floor(similarity2 * 10);
                            if (points2 > 0) {
                                this.score2 += points2;
                                this.scoreEl2.textContent = Math.floor(this.score2);
                                this.updateCombinedScore();
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

    updateCombinedScore() {
        const combined = this.score1 + this.score2;
        this.combinedScoreEl.textContent = Math.floor(combined);
    }

    stop() {
        this.isRunning = false;
        
        // Stop and reset videos
        this.referenceVideo1.pause();
        this.referenceVideo1.currentTime = 0;
        this.referenceVideo2.pause();
        this.referenceVideo2.currentTime = 0;
        
        // Stop camera
        if (this.camera) {
            this.camera.getTracks().forEach(track => track.stop());
            this.camera = null;
        }
        this.cameraVideo.srcObject = null;
        
        // Clear canvases
        [this.referenceCanvas1, this.referenceCanvas2, this.cameraCanvas].forEach(canvas => {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        });
        
        // Show final scores
        this.showFinalScores();
        
        this.statusEl.textContent = 'Stopped. Everything cleared. Ready to start again.';
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new DanceBattleApp2Player();
});
