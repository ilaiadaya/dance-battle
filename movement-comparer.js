class MovementComparer {
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

        // Calculate similarity based on key point positions
        let totalDistance = 0;
        let validPoints = 0;

        // Key points to compare (major body parts)
        const keyPoints = [
            0,  // nose
            2,  // left eye
            5,  // right eye
            11, // left shoulder
            12, // right shoulder
            13, // left elbow
            14, // right elbow
            15, // left wrist
            16, // right wrist
            23, // left hip
            24, // right hip
            25, // left knee
            26, // right knee
            27, // left ankle
            28  // right ankle
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
        
        // Convert distance to similarity score (0-1)
        // Lower distance = higher similarity
        // Using a threshold where distance > 0.2 = 0 similarity
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

