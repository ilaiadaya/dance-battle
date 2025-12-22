class ScoreManager {
    constructor(targetScore = 1000) {
        this.score = 0;
        this.targetScore = targetScore;
        this.onScoreUpdate = null;
        this.onWin = null;
        this.hasWon = false;
    }

    addPoints(points) {
        this.score = this.score + points; // Remove cap, let it keep going
        
        if (this.onScoreUpdate) {
            this.onScoreUpdate(this.score, this.targetScore);
        }

        // Only trigger win once when reaching target, but keep scoring
        if (this.score >= this.targetScore && !this.hasWon && this.onWin) {
            this.hasWon = true;
            this.onWin();
        }
    }

    reset() {
        this.score = 0;
        this.hasWon = false;
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

