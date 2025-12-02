export class MovementComparer {
  constructor() {
    this.referencePoses = [];
    this.currentFrameIndex = 0;
  }

  setReferencePoses(poses) {
    this.referencePoses = poses;
    this.currentFrameIndex = 0;
  }

  comparePoses(userLandmarks, referenceLandmarks) {
    if (!userLandmarks || !referenceLandmarks) {
      return 0;
    }

    if (userLandmarks.length !== referenceLandmarks.length) {
      return 0;
    }

    let totalDistance = 0;
    let validPoints = 0;

    const keyPoints = [
      0, 2, 5, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28
    ];

    keyPoints.forEach((index) => {
      const userPoint = userLandmarks[index];
      const refPoint = referenceLandmarks[index];

      if (userPoint && refPoint && 
          userPoint.visibility > 0.5 && refPoint.visibility > 0.5) {
        const dx = userPoint.x - refPoint.x;
        const dy = userPoint.y - refPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        totalDistance += distance;
        validPoints++;
      }
    });

    if (validPoints === 0) {
      return 0;
    }

    const averageDistance = totalDistance / validPoints;
    const similarity = Math.max(0, 1 - (averageDistance / 0.2));
    
    return similarity;
  }

  getCurrentReferencePose() {
    if (this.referencePoses.length === 0) {
      return null;
    }
    const pose = this.referencePoses[this.currentFrameIndex];
    this.currentFrameIndex = (this.currentFrameIndex + 1) % this.referencePoses.length;
    return pose;
  }

  reset() {
    this.currentFrameIndex = 0;
  }
}

