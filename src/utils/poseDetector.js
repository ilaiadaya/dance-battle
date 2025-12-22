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
      if (this.currentCanvas) {
        this.drawPose(results, this.currentCanvas);
      }
      
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
      this.currentCanvas = canvasElement;
      this.pendingResolves.push(resolve);
      this.pose.send({ image: imageElement });
    });
  }

  drawPose(results, canvasElement) {
    if (!canvasElement) {
      console.warn('drawPose: canvas element is null');
      return;
    }

    const ctx = canvasElement.getContext('2d');
    if (!ctx) {
      console.warn('drawPose: could not get canvas context');
      return;
    }

    ctx.save();
    
    // Ensure canvas is sized correctly
    const rect = canvasElement.getBoundingClientRect();
    if (canvasElement.width !== rect.width || canvasElement.height !== rect.height) {
      canvasElement.width = rect.width;
      canvasElement.height = rect.height;
    }
    
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
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
    ctx.lineWidth = 3;

    const minVisibility = 0.1; // Minimum visibility threshold

    connections.forEach(([start, end]) => {
      const startPoint = landmarks[start];
      const endPoint = landmarks[end];

      if (startPoint && endPoint) {
        // Check visibility for both points
        const startVis = startPoint.visibility !== undefined ? startPoint.visibility : 1;
        const endVis = endPoint.visibility !== undefined ? endPoint.visibility : 1;
        
        // Only draw if both points have sufficient visibility
        if (startVis >= minVisibility && endVis >= minVisibility) {
          // Skip if coordinates are invalid (0,0 with 0 visibility usually means not detected)
          if (startPoint.x === 0 && startPoint.y === 0 && startVis === 0) return;
          if (endPoint.x === 0 && endPoint.y === 0 && endVis === 0) return;
          
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
      }
    });
  }

  drawLandmarks(ctx, landmarks) {
    ctx.fillStyle = '#FF0000';
    const minVisibility = 0.1; // Minimum visibility threshold

    landmarks.forEach((landmark) => {
      if (!landmark) return;
      
      const visibility = landmark.visibility !== undefined ? landmark.visibility : 1;
      
      // Only draw if visibility is sufficient
      if (visibility >= minVisibility) {
        // Skip if coordinates are invalid
        if (landmark.x === 0 && landmark.y === 0 && visibility === 0) return;
        
        const x = landmark.x * ctx.canvas.width;
        const y = landmark.y * ctx.canvas.height;

        // Adjust alpha based on visibility for better visualization
        const alpha = Math.min(visibility * 2, 1);
        ctx.globalAlpha = alpha;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.globalAlpha = 1.0; // Reset alpha
      }
    });
  }

  getPoseLandmarks(results) {
    return results.poseLandmarks || null;
  }

  drawStoredLandmarks(landmarks, canvasElement) {
    if (!landmarks || !canvasElement) {
      console.warn('drawStoredLandmarks: missing landmarks or canvas', { 
        landmarks: !!landmarks, 
        canvas: !!canvasElement 
      });
      return;
    }

    const ctx = canvasElement.getContext('2d');
    if (!ctx) {
      console.warn('drawStoredLandmarks: could not get canvas context');
      return;
    }

    ctx.save();
    
    // Ensure canvas is sized correctly - try multiple methods
    const rect = canvasElement.getBoundingClientRect();
    let canvasWidth = rect.width;
    let canvasHeight = rect.height;
    
    // If rect is 0, try to get size from parent or video
    if (canvasWidth === 0 || canvasHeight === 0) {
      const parent = canvasElement.parentElement;
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        canvasWidth = parentRect.width || 640;
        canvasHeight = parentRect.height || 480;
      }
      
      // Try to find video element in parent
      const video = canvasElement.parentElement?.querySelector('video');
      if (video && video.videoWidth && video.videoHeight) {
        canvasWidth = video.videoWidth;
        canvasHeight = video.videoHeight;
      }
    }
    
    // Fallback to default size if still 0
    if (canvasWidth === 0 || canvasHeight === 0) {
      canvasWidth = 640;
      canvasHeight = 480;
    }
    
    if (canvasElement.width !== canvasWidth || canvasElement.height !== canvasHeight) {
      canvasElement.width = canvasWidth;
      canvasElement.height = canvasHeight;
    }
    
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Validate landmarks array
    if (!Array.isArray(landmarks) || landmarks.length === 0) {
      console.warn('drawStoredLandmarks: invalid landmarks array', landmarks);
      ctx.restore();
      return;
    }

    // Debug: log first frame occasionally
    if (Math.random() < 0.01) {
      const validCount = landmarks.filter(l => 
        l && l.visibility >= 0.1 && !(l.x === 0 && l.y === 0 && l.visibility === 0)
      ).length;
      console.log('Drawing stored landmarks:', {
        total: landmarks.length,
        valid: validCount,
        canvasSize: `${canvasElement.width}x${canvasElement.height}`,
        sample: landmarks.slice(0, 3).map(l => ({
          x: l.x,
          y: l.y,
          visibility: l.visibility
        }))
      });
    }

    this.drawConnections(ctx, landmarks, POSE_CONNECTIONS);
    this.drawLandmarks(ctx, landmarks);

    ctx.restore();
  }

  async detectPoseOnly(imageElement) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve) => {
      const previousCanvas = this.currentCanvas;
      this.currentCanvas = null;
      
      this.pendingResolves.push((results) => {
        this.currentCanvas = previousCanvas;
        resolve(results);
      });

      this.pose.send({ image: imageElement });
    });
  }
}






