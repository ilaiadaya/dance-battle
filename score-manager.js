class ScoreManager {
    constructor(targetScore = 1000) {
        this.score = 0;
        this.targetScore = targetScore;
        this.onScoreUpdate = null;
        this.onWin = null;
    }

    addPoints(points) {
        this.score = Math.min(this.score + points, this.targetScore);
        
        if (this.onScoreUpdate) {
            this.onScoreUpdate(this.score, this.targetScore);
        }

        if (this.score >= this.targetScore && this.onWin) {
            this.onWin();
        }
    }

    reset() {
        this.score = 0;
        if (this.onScoreUpdate) {
            this.onScoreUpdate(this.score, this.targetScore);
        }
    }

    setTargetScore(target) {
        this.targetScore = target;
        if (this.onScoreUpdate) {
            this.onScoreUpdate(this.score, this.targetScore);
        }
    }
}

