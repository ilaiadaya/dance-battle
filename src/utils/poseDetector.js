// MediaPipe Pose connections (33 landmarks)
export const POSE_CONNECTIONS = [
    // Face
    [0, 1], [1, 2], [2, 3], [3, 7],
    [0, 4], [4, 5], [5, 6], [6, 8],
    [9, 10],
    // Torso
    [11, 12], [11, 23], [12, 24], [23, 24],
    // Left arm
    [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19], [19, 21],
    // Right arm
    [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20], [20, 22],
    // Left leg
    [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
    // Right leg
    [24, 26], [26, 28], [28, 30], [28, 32], [30, 32]
];

export class PoseDetector {
    constructor() {
        this.pose = null;
        this.isInitialized = false;
        this.pendingResolves = [];
        this.currentCanvas = null;
    }

    async initialize() {
        if (this.isInitialized) return;

        // Wait for Pose to be available
        if (typeof window.Pose === 'undefined') {
            await new Promise((resolve) => {
                const checkPose = setInterval(() => {
                    if (typeof window.Pose !== 'undefined') {
                        clearInterval(checkPose);
                        resolve();
                    }
                }, 100);
            });
        }

        this.pose = new window.Pose({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
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

        // Set up the results callback once
        this.pose.onResults((results) => {
            // Draw on the current canvas if provided
            if (this.currentCanvas) {
                this.drawPose(results, this.currentCanvas);
            }
            
            // Resolve any pending promises
            const resolve = this.pendingResolves.shift();
            if (resolve) {
                resolve(results);
            }
        });

        this.isInitialized = true;
    }

    async detectPose(imageElement, canvasElement) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return new Promise((resolve) => {
            // Store the canvas for drawing
            this.currentCanvas = canvasElement;
            
            // Add to pending resolves queue
            this.pendingResolves.push(resolve);

            // Send the image for processing
            this.pose.send({ image: imageElement });
        });
    }

    drawPose(results, canvasElement) {
        if (!canvasElement) return;
        
        const ctx = canvasElement.getContext('2d');
        if (!ctx) return;
        
        ctx.save();
        
        // Get the parent video wrapper to find the video element
        const videoWrapper = canvasElement.parentElement;
        const video = videoWrapper?.querySelector('video');
        
        // Set canvas size to match video's actual dimensions
        if (video) {
            const videoWidth = video.videoWidth || video.offsetWidth || 640;
            const videoHeight = video.videoHeight || video.offsetHeight || 480;
            
            if (canvasElement.width !== videoWidth || canvasElement.height !== videoHeight) {
                canvasElement.width = videoWidth;
                canvasElement.height = videoHeight;
            }
        } else {
            // Fallback to offset dimensions
            const width = canvasElement.offsetWidth || 640;
            const height = canvasElement.offsetHeight || 480;
            if (canvasElement.width !== width || canvasElement.height !== height) {
                canvasElement.width = width;
                canvasElement.height = height;
            }
        }
        
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (results.poseLandmarks && canvasElement.width > 0 && canvasElement.height > 0) {
            // Use MediaPipe's drawing utilities if available, otherwise use custom drawing
            if (typeof window.drawConnectors !== 'undefined' && typeof window.drawLandmarks !== 'undefined') {
                window.drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
                    color: '#00FF00',
                    lineWidth: 2
                });
                window.drawLandmarks(ctx, results.poseLandmarks, {
                    color: '#FF0000',
                    radius: 3
                });
            } else {
                this.drawConnections(ctx, results.poseLandmarks, POSE_CONNECTIONS);
                this.drawLandmarks(ctx, results.poseLandmarks);
            }
        }

        ctx.restore();
    }

    drawConnections(ctx, landmarks, connections) {
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 3; // Make thicker for visibility

        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];

            if (startPoint && endPoint && 
                startPoint.visibility > 0.3 && endPoint.visibility > 0.3) {
                ctx.beginPath();
                ctx.moveTo(
                    startPoint.x * ctx.canvas.width,
                    startPoint.y * ctx.canvas.height
                );
                ctx.lineTo(
                    endPoint.x * ctx.canvas.width,
                    endPoint.y * ctx.canvas.height
                );
                ctx.stroke();
            }
        });
    }

    drawLandmarks(ctx, landmarks) {
        ctx.fillStyle = '#FF0000';
        landmarks.forEach((landmark) => {
            if (landmark && landmark.visibility > 0.3) {
                const x = landmark.x * ctx.canvas.width;
                const y = landmark.y * ctx.canvas.height;

                ctx.beginPath();
                ctx.arc(x, y, 4, 0, 2 * Math.PI); // Slightly larger for visibility
                ctx.fill();
            }
        });
    }

    getPoseLandmarks(results) {
        return results.poseLandmarks || null;
    }

    // Draw pre-stored landmarks without detection
    drawStoredLandmarks(landmarks, canvasElement) {
        if (!landmarks || !canvasElement) return;

        const ctx = canvasElement.getContext('2d');
        if (!ctx) return;
        
        ctx.save();
        
        // Get the parent video wrapper to find the video element
        const videoWrapper = canvasElement.parentElement;
        const video = videoWrapper?.querySelector('video');
        
        // Set canvas size to match video's actual dimensions
        if (video) {
            const videoWidth = video.videoWidth || video.offsetWidth || 640;
            const videoHeight = video.videoHeight || video.offsetHeight || 480;
            
            if (canvasElement.width !== videoWidth || canvasElement.height !== videoHeight) {
                canvasElement.width = videoWidth;
                canvasElement.height = videoHeight;
            }
        } else {
            // Fallback to offset dimensions
            const width = canvasElement.offsetWidth || 640;
            const height = canvasElement.offsetHeight || 480;
            if (canvasElement.width !== width || canvasElement.height !== height) {
                canvasElement.width = width;
                canvasElement.height = height;
            }
        }
        
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (canvasElement.width > 0 && canvasElement.height > 0) {
            this.drawConnections(ctx, landmarks, POSE_CONNECTIONS);
            this.drawLandmarks(ctx, landmarks);
        }

        ctx.restore();
    }

    // Detect pose without drawing (for analysis)
    async detectPoseOnly(imageElement) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return new Promise((resolve) => {
            // Don't draw for analysis
            const previousCanvas = this.currentCanvas;
            this.currentCanvas = null;
            
            // Add to pending resolves queue
            this.pendingResolves.push((results) => {
                // Restore canvas setting
                this.currentCanvas = previousCanvas;
                resolve(results);
            });

            // Send the image for processing
            this.pose.send({ image: imageElement });
        });
    }
}

