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

    drawConnections(ctx, landmarks, connections, color = '#00FF00') {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];

            // Only draw if both points exist, have visibility > 0.5, and are not at origin (0,0)
            if (startPoint && endPoint && 
                startPoint.visibility > 0.5 && endPoint.visibility > 0.5 &&
                (startPoint.x !== 0 || startPoint.y !== 0) &&
                (endPoint.x !== 0 || endPoint.y !== 0)) {
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

    drawLandmarks(ctx, landmarks, color = '#FF0000') {
        ctx.fillStyle = color;
        landmarks.forEach((landmark) => {
            // Only draw if landmark has good visibility and is not at origin
            if (landmark && landmark.visibility > 0.5 && 
                (landmark.x !== 0 || landmark.y !== 0)) {
                const x = landmark.x * ctx.canvas.width;
                const y = landmark.y * ctx.canvas.height;

                ctx.beginPath();
                ctx.arc(x, y, 3, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    }

    getPoseLandmarks(results) {
        return results.poseLandmarks || null;
    }

    // Draw pre-stored landmarks without detection (supports single pose or array of poses)
    // This matches the exact same style as drawPose used for camera feed
    drawStoredLandmarks(landmarks, canvasElement, colors = ['#00FF00', '#00FFFF', '#FF00FF', '#FFFF00']) {
        if (!landmarks) return;

        // Check if it's an array of poses (multi-person) or single pose
        if (Array.isArray(landmarks) && landmarks.length > 0 && Array.isArray(landmarks[0])) {
            // Multi-person: array of pose arrays
            this.drawMultiplePoses(landmarks, canvasElement, colors);
        } else if (Array.isArray(landmarks) && landmarks.length > 0 && landmarks[0].x !== undefined) {
            // Single pose: array of landmarks - use EXACT same style as drawPose
            const ctx = canvasElement.getContext('2d');
            ctx.save();
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            
            // Set canvas size to match video (same as drawPose)
            if (canvasElement.width !== canvasElement.offsetWidth || 
                canvasElement.height !== canvasElement.offsetHeight) {
                canvasElement.width = canvasElement.offsetWidth;
                canvasElement.height = canvasElement.offsetHeight;
            }

            // Use MediaPipe's drawing utilities if available (same as drawPose), otherwise use custom drawing
            if (typeof drawConnectors !== 'undefined' && typeof drawLandmarks !== 'undefined') {
                drawConnectors(ctx, landmarks, POSE_CONNECTIONS, {
                    color: '#00FF00',
                    lineWidth: 2
                });
                drawLandmarks(ctx, landmarks, {
                    color: '#FF0000',
                    radius: 3
                });
            } else {
                // Use same custom drawing methods as drawPose
                this.drawConnections(ctx, landmarks, POSE_CONNECTIONS, '#00FF00');
                this.drawLandmarks(ctx, landmarks, '#FF0000');
            }

            ctx.restore();
        }
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

    // Detect multiple people by processing frame in regions
    async detectMultiplePoses(imageElement) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const allPoses = [];
        
        // Try to detect poses in different regions of the frame
        // Split frame into 4 quadrants and also try full frame
        const regions = [
            { x: 0, y: 0, width: 1, height: 1 }, // Full frame
            { x: 0, y: 0, width: 0.5, height: 1 }, // Left half
            { x: 0.5, y: 0, width: 0.5, height: 1 }, // Right half
            { x: 0, y: 0, width: 1, height: 0.5 }, // Top half
            { x: 0, y: 0.5, width: 1, height: 0.5 }, // Bottom half
        ];

        // Create a canvas for region extraction
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Get image dimensions
        let imgWidth, imgHeight;
        if (imageElement instanceof HTMLVideoElement || imageElement instanceof HTMLImageElement) {
            imgWidth = imageElement.videoWidth || imageElement.width || 640;
            imgHeight = imageElement.videoHeight || imageElement.height || 480;
        } else if (imageElement instanceof HTMLCanvasElement) {
            imgWidth = imageElement.width;
            imgHeight = imageElement.height;
        } else {
            imgWidth = 640;
            imgHeight = 480;
        }

        canvas.width = imgWidth;
        canvas.height = imgHeight;

        // Try each region
        for (const region of regions) {
            try {
                // Extract region
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const sx = region.x * imgWidth;
                const sy = region.y * imgHeight;
                const sw = region.width * imgWidth;
                const sh = region.height * imgHeight;
                
                ctx.drawImage(
                    imageElement,
                    sx, sy, sw, sh,
                    0, 0, canvas.width, canvas.height
                );

                // Detect pose in this region
                const results = await this.detectPoseOnly(canvas);
                const landmarks = results.poseLandmarks;
                
                if (landmarks && this.hasValidPose(landmarks)) {
                    // Adjust coordinates back to full frame coordinates
                    const adjustedLandmarks = landmarks.map(lm => ({
                        ...lm,
                        x: lm.x * region.width + region.x,
                        y: lm.y * region.height + region.y
                    }));
                    
                    // Check if this pose is different from already detected poses
                    if (!this.isDuplicatePose(adjustedLandmarks, allPoses)) {
                        allPoses.push(adjustedLandmarks);
                    }
                }
            } catch (error) {
                console.error('Error detecting pose in region:', error);
            }
        }

        // If we found multiple poses, return them; otherwise try full frame detection
        if (allPoses.length > 0) {
            return allPoses;
        }
        
        // Fallback to single pose detection
        try {
            const results = await this.detectPoseOnly(imageElement);
            if (results.poseLandmarks && this.hasValidPose(results.poseLandmarks)) {
                return [results.poseLandmarks];
            }
        } catch (error) {
            console.error('Error in fallback detection:', error);
        }
        
        return [];
    }

    hasValidPose(landmarks) {
        if (!landmarks || landmarks.length < 33) return false;
        
        // Check if we have enough visible key points
        const keyPoints = [11, 12, 23, 24]; // shoulders and hips
        let visibleCount = 0;
        keyPoints.forEach(index => {
            if (landmarks[index] && landmarks[index].visibility > 0.5) {
                visibleCount++;
            }
        });
        return visibleCount >= 2;
    }

    isDuplicatePose(newPose, existingPoses, threshold = 0.15) {
        for (const existingPose of existingPoses) {
            let totalDistance = 0;
            let validPoints = 0;
            
            const keyPoints = [11, 12, 23, 24]; // shoulders and hips
            keyPoints.forEach(index => {
                if (newPose[index] && existingPose[index] &&
                    newPose[index].visibility > 0.5 && existingPose[index].visibility > 0.5) {
                    const dx = newPose[index].x - existingPose[index].x;
                    const dy = newPose[index].y - existingPose[index].y;
                    totalDistance += Math.sqrt(dx * dx + dy * dy);
                    validPoints++;
                }
            });
            
            if (validPoints > 0) {
                const avgDistance = totalDistance / validPoints;
                if (avgDistance < threshold) {
                    return true; // This is a duplicate
                }
            }
        }
        return false;
    }

    // Draw multiple poses with different colors
    drawMultiplePoses(posesArray, canvasElement, colors = ['#00FF00', '#00FFFF', '#FF00FF', '#FFFF00']) {
        if (!posesArray || posesArray.length === 0) return;
        
        const ctx = canvasElement.getContext('2d');
        ctx.save();
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Set canvas size to match video
        if (canvasElement.width !== canvasElement.offsetWidth || 
            canvasElement.height !== canvasElement.offsetHeight) {
            canvasElement.width = canvasElement.offsetWidth;
            canvasElement.height = canvasElement.offsetHeight;
        }

        posesArray.forEach((landmarks, index) => {
            if (!landmarks) return;
            
            const color = colors[index % colors.length];
            this.drawConnections(ctx, landmarks, POSE_CONNECTIONS, color);
            this.drawLandmarks(ctx, landmarks, color);
        });

        ctx.restore();
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

