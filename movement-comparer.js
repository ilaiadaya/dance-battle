class MovementComparer {
    constructor() {
        this.referencePoses = [];
        this.currentFrameIndex = 0;
        this.movementThreshold = 0.02; // Minimum movement to consider active (2% of frame)
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

    // Check if there's significant movement between two poses
    hasSignificantMovement(pose1, pose2) {
        if (!pose1 || !pose2) return false;

        let totalMovement = 0;
        let validPoints = 0;

        // Key body points to check for movement
        const keyPoints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]; // shoulders, elbows, wrists, hips, knees, ankles

        keyPoints.forEach((index) => {
            const point1 = pose1[index];
            const point2 = pose2[index];

            if (point1 && point2 && 
                point1.visibility > 0.5 && point2.visibility > 0.5) {
                const dx = point2.x - point1.x;
                const dy = point2.y - point1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                totalMovement += distance;
                validPoints++;
            }
        });

        if (validPoints === 0) return false;

        const averageMovement = totalMovement / validPoints;
        return averageMovement > this.movementThreshold;
    }

    // Check if a pose has a full body (enough key points detected)
    hasFullBody(landmarks) {
        if (!landmarks || landmarks.length < 33) return false;

        // Check for key body parts
        const requiredPoints = [
            11, 12, // shoulders
            23, 24, // hips
            13, 14, // elbows (at least one)
            15, 16, // wrists (at least one)
            25, 26, // knees (at least one)
            27, 28  // ankles (at least one)
        ];

        let detectedPoints = 0;
        requiredPoints.forEach((index) => {
            const point = landmarks[index];
            if (point && point.visibility > 0.5) {
                detectedPoints++;
            }
        });

        // Need at least 6 out of 10 key points for full body
        return detectedPoints >= 6;
    }
}

