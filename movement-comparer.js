class MovementComparer {
    constructor() {
        this.referencePoses = []; // Array of frames, each frame can have multiple poses (array of landmark arrays)
        this.currentFrameIndex = 0;
        this.movementThreshold = 0.02; // Minimum movement to consider active (2% of frame)
        this.isMultiPerson = false; // Track if we're dealing with multi-person video
    }

    setReferencePoses(poses) {
        this.referencePoses = poses;
        this.currentFrameIndex = 0;
        // Check if this is multi-person (first frame is array of arrays)
        if (poses.length > 0 && Array.isArray(poses[0]) && poses[0].length > 0 && Array.isArray(poses[0][0])) {
            this.isMultiPerson = true;
        } else {
            this.isMultiPerson = false;
        }
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

    // Get all reference poses for current frame (for multi-person)
    getCurrentReferencePoses() {
        if (this.referencePoses.length === 0) {
            return [];
        }

        const framePoses = this.referencePoses[this.currentFrameIndex];
        this.currentFrameIndex = (this.currentFrameIndex + 1) % this.referencePoses.length;
        
        // If multi-person, return array of poses; otherwise wrap single pose in array
        if (this.isMultiPerson && Array.isArray(framePoses)) {
            return framePoses;
        } else if (framePoses) {
            return [framePoses];
        }
        return [];
    }

    // Check if any reference person has significant movement
    hasSignificantMovementMultiPerson(poseArray1, poseArray2) {
        if (!poseArray1 || !poseArray2) return false;
        
        // Check each person in the frame
        for (let i = 0; i < Math.min(poseArray1.length, poseArray2.length); i++) {
            if (this.hasSignificantMovement(poseArray1[i], poseArray2[i])) {
                return true; // At least one person is moving
            }
        }
        return false;
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

        // Check for critical body parts - require ALL critical points for true full body
        const criticalPoints = [
            11, 12, // both shoulders (REQUIRED)
            23, 24, // both hips (REQUIRED)
        ];
        
        const importantPoints = [
            13, 14, // elbows
            15, 16, // wrists
            25, 26, // knees
            27, 28  // ankles
        ];

        // Must have ALL 4 critical points (both shoulders AND both hips)
        let criticalDetected = 0;
        criticalPoints.forEach((index) => {
            const point = landmarks[index];
            if (point && point.visibility > 0.5) {
                criticalDetected++;
            }
        });
        
        // Require ALL 4 critical points (both shoulders AND both hips)
        if (criticalDetected < 4) return false;

        // Also need at least 6 out of 8 important points (limbs) for complete full body
        let importantDetected = 0;
        importantPoints.forEach((index) => {
            const point = landmarks[index];
            if (point && point.visibility > 0.5) {
                importantDetected++;
            }
        });

        // Need at least 6 limb points for a complete full body (was 4, now stricter)
        return importantDetected >= 6;
    }

    // Check if lighting/background quality is good enough for detection
    hasGoodLighting(landmarks) {
        if (!landmarks || landmarks.length < 33) return false;
        
        // Check average visibility of key body points
        const keyPoints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
        let totalVisibility = 0;
        let validPoints = 0;
        
        keyPoints.forEach((index) => {
            const point = landmarks[index];
            if (point) {
                totalVisibility += point.visibility;
                validPoints++;
            }
        });
        
        if (validPoints === 0) return false;
        
        const averageVisibility = totalVisibility / validPoints;
        // Require average visibility of at least 0.5 for good lighting/background (less strict)
        return averageVisibility >= 0.5;
    }
}

