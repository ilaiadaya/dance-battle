class VideoAnalyzer {
    constructor(poseDetector) {
        this.poseDetector = poseDetector;
        this.analysisVideo = document.getElementById('analysisVideo');
        this.analysisCanvas = document.getElementById('analysisCanvas');
        this.videoFileInput = document.getElementById('videoFileInput');
        this.selectVideoBtn = document.getElementById('selectVideoBtn');
        this.analyzeVideoBtn = document.getElementById('analyzeVideoBtn');
        this.closeAnalysisBtn = document.getElementById('closeAnalysisBtn');
        this.analysisStatus = document.getElementById('analysisStatus');
        this.analysisProgress = document.getElementById('analysisProgress');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.selectedFileName = document.getElementById('selectedFileName');
        
        this.currentVideoFile = null;
        this.analyzedPoses = [];
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.selectVideoBtn.addEventListener('click', () => {
            this.videoFileInput.click();
        });

        this.videoFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadVideoFile(file);
            }
        });

        this.analyzeVideoBtn.addEventListener('click', () => {
            this.analyzeVideo();
        });

        this.closeAnalysisBtn.addEventListener('click', () => {
            this.close();
        });
    }

    loadVideoFile(file) {
        this.currentVideoFile = file;
        this.selectedFileName.textContent = `Selected: ${file.name}`;
        this.analyzeVideoBtn.disabled = false;
        
        const url = URL.createObjectURL(file);
        this.analysisVideo.src = url;
        this.analysisVideo.style.display = 'block';
        this.analysisStatus.textContent = `Loaded: ${file.name}. Click "Analyze & Save" to process.`;
    }

    async analyzeVideo() {
        if (!this.currentVideoFile) return;

        this.analyzeVideoBtn.disabled = true;
        this.analysisProgress.style.display = 'block';
        this.analyzedPoses = [];

        const video = this.analysisVideo;
        video.currentTime = 0;

        // Wait for video to be ready
        await new Promise((resolve) => {
            if (video.readyState >= 2) {
                resolve();
            } else {
                video.addEventListener('loadedmetadata', resolve, { once: true });
            }
        });

        const fps = 30;
        const frameInterval = 1 / fps;
        const maxDuration = video.duration;
        const totalFrames = Math.ceil(maxDuration * fps);
        let frameCount = 0;

        // Create analysis canvas
        const analysisCanvas = document.createElement('canvas');
        analysisCanvas.width = video.videoWidth || 640;
        analysisCanvas.height = video.videoHeight || 480;
        const analysisCtx = analysisCanvas.getContext('2d');

        this.analysisStatus.textContent = 'Analyzing video... This may take a moment.';

        const analyzeNextFrame = async () => {
            if (video.currentTime >= maxDuration - 0.1) {
                // Done analyzing
                this.analysisStatus.textContent = `✅ Analysis complete! Analyzed ${this.analyzedPoses.length} frames.`;
                this.progressFill.style.width = '100%';
                this.progressText.textContent = '100%';
                
                // Save the data
                await this.saveAnalysisData();
                
                this.analyzeVideoBtn.disabled = false;
                return;
            }

            try {
                // Draw current frame to canvas
                analysisCtx.drawImage(video, 0, 0, analysisCanvas.width, analysisCanvas.height);
                
                // Detect pose
                const results = await this.poseDetector.detectPoseOnly(analysisCanvas);
                const landmarks = this.poseDetector.getPoseLandmarks(results);
                
                if (landmarks) {
                    this.analyzedPoses.push(landmarks);
                }

                frameCount++;
                const progress = Math.min(Math.floor((frameCount / totalFrames) * 100), 100);
                this.progressFill.style.width = `${progress}%`;
                this.progressText.textContent = `${progress}%`;
                this.analysisStatus.textContent = `Analyzing... ${progress}% (${this.analyzedPoses.length} poses detected)`;

                // Seek to next frame
                const nextTime = Math.min(video.currentTime + frameInterval, maxDuration);
                video.currentTime = nextTime;
                
                // Wait for seek
                await new Promise(seekResolve => {
                    const onSeeked = () => {
                        video.removeEventListener('seeked', onSeeked);
                        seekResolve();
                    };
                    video.addEventListener('seeked', onSeeked, { once: true });
                    setTimeout(() => {
                        video.removeEventListener('seeked', onSeeked);
                        seekResolve();
                    }, 200);
                });

                await new Promise(resolve => setTimeout(resolve, 10));
                analyzeNextFrame();
            } catch (error) {
                console.error('Error analyzing frame:', error);
                video.currentTime = Math.min(video.currentTime + frameInterval, maxDuration);
                await new Promise(resolve => setTimeout(resolve, 50));
                analyzeNextFrame();
            }
        };

        // Start analysis
        await new Promise(resolve => {
            const onSeeked = () => {
                video.removeEventListener('seeked', onSeeked);
                setTimeout(resolve, 100);
            };
            video.addEventListener('seeked', onSeeked, { once: true });
        });

        analyzeNextFrame();
    }

    async saveAnalysisData() {
        if (this.analyzedPoses.length === 0) {
            this.analysisStatus.textContent = '❌ No poses detected. Cannot save.';
            return;
        }

        const fileName = this.currentVideoFile.name.replace(/\.[^/.]+$/, ''); // Remove extension
        const storageKey = `danceBattle_${fileName}`;

        try {
            // Try IndexedDB first for larger data
            if ('indexedDB' in window) {
                await this.saveToIndexedDB(storageKey, this.analyzedPoses);
                this.analysisStatus.textContent = `✅ Saved ${this.analyzedPoses.length} poses to IndexedDB!\nKey: "${storageKey}"\nYou can now use this video in the dance battle!`;
            } else {
                // Fallback to localStorage
                const data = JSON.stringify(this.analyzedPoses);
                localStorage.setItem(storageKey, data);
                this.analysisStatus.textContent = `✅ Saved ${this.analyzedPoses.length} poses to localStorage!\nKey: "${storageKey}"\nYou can now use this video in the dance battle!`;
            }
            
            // Also offer to download as backup
            this.offerDownload(storageKey);
        } catch (error) {
            console.error('Error saving:', error);
            this.analysisStatus.textContent = `❌ Error saving: ${error.message}`;
        }
    }

    offerDownload(key) {
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-primary';
        downloadBtn.textContent = 'Download Analysis Data (Backup)';
        downloadBtn.style.marginTop = '10px';
        downloadBtn.onclick = () => {
            const dataStr = JSON.stringify(this.analyzedPoses);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${key}.json`;
            a.click();
            URL.revokeObjectURL(url);
        };
        this.analysisStatus.appendChild(downloadBtn);
    }

    async saveToIndexedDB(key, data) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('DanceBattleDB', 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['poses'], 'readwrite');
                const store = transaction.objectStore('poses');
                const putRequest = store.put({ key, data, timestamp: Date.now() });
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('poses')) {
                    db.createObjectStore('poses', { keyPath: 'key' });
                }
            };
        });
    }

    async loadFromIndexedDB(key) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('DanceBattleDB', 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['poses'], 'readonly');
                const store = transaction.objectStore('poses');
                const getRequest = store.get(key);
                getRequest.onsuccess = () => {
                    if (getRequest.result) {
                        resolve(getRequest.result.data);
                    } else {
                        resolve(null);
                    }
                };
                getRequest.onerror = () => reject(getRequest.error);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('poses')) {
                    db.createObjectStore('poses', { keyPath: 'key' });
                }
            };
        });
    }

    close() {
        document.getElementById('analysisSection').style.display = 'none';
        this.analysisVideo.src = '';
        this.currentVideoFile = null;
        this.analyzedPoses = [];
        this.analysisProgress.style.display = 'none';
    }

    show() {
        document.getElementById('analysisSection').style.display = 'block';
    }
}

