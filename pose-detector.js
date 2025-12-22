class PoseDetector {
    constructor() {
        this.pose = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        // Wait for Pose to be available
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

        this.isInitialized = true;
    }

    async detectPose(imageElement, canvasElement) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return new Promise((resolve) => {
            this.pose.onResults((results) => {
                this.drawPose(results, canvasElement);
                resolve(results);
            });

            this.pose.send({ image: imageElement });
        });
    }

    drawPose(results, canvasElement) {
        const ctx = canvasElement.getContext('2d');
        ctx.save();
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Set canvas size to match video
        if (canvasElement.width !== canvasElement.offsetWidth || 
            canvasElement.height !== canvasElement.offsetHeight) {
            canvasElement.width = canvasElement.offsetWidth;
            canvasElement.height = canvasElement.offsetHeight;
        }

        if (results.poseLandmarks) {
            // Use MediaPipe's drawing utilities if available, otherwise use custom drawing
            if (typeof drawConnectors !== 'undefined' && typeof drawLandmarks !== 'undefined') {
                drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
                    color: '#00FF00',
                    lineWidth: 2
                });
                drawLandmarks(ctx, results.poseLandmarks, {
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
        ctx.lineWidth = 2;

        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];

            if (startPoint && endPoint) {
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
            const x = landmark.x * ctx.canvas.width;
            const y = landmark.y * ctx.canvas.height;

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    getPoseLandmarks(results) {
        return results.poseLandmarks || null;
    }

    // Draw pre-stored landmarks without detection
    drawStoredLandmarks(landmarks, canvasElement) {
        if (!landmarks) return;

        const ctx = canvasElement.getContext('2d');
        ctx.save();
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Set canvas size to match video
        if (canvasElement.width !== canvasElement.offsetWidth || 
            canvasElement.height !== canvasElement.offsetHeight) {
            canvasElement.width = canvasElement.offsetWidth;
            canvasElement.height = canvasElement.offsetHeight;
        }

        this.drawConnections(ctx, landmarks, POSE_CONNECTIONS);
        this.drawLandmarks(ctx, landmarks);

        ctx.restore();
    }

    // Detect pose without drawing (for analysis)
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
}

// MediaPipe Pose connections (33 landmarks)
// Using standard MediaPipe Pose connections
const POSE_CONNECTIONS = [
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

