import { useState, useRef } from 'react';
import { PoseDetector } from '../utils/poseDetector';
import { savePoses } from '../utils/storage';

export default function VideoAnalyzer({ onClose }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState('Select a video file to analyze');
  const [progress, setProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const videoFileInputRef = useRef(null);
  const analysisVideoRef = useRef(null);
  const progressFillRef = useRef(null);
  const progressTextRef = useRef(null);
  const poseDetectorRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      if (analysisVideoRef.current) {
        analysisVideoRef.current.src = url;
        analysisVideoRef.current.style.display = 'block';
      }
      setStatus(`Loaded: ${file.name}. Click "Analyze & Save" to process.`);
    }
  };

  const analyzeVideo = async () => {
    if (!selectedFile || !analysisVideoRef.current) return;

    setIsAnalyzing(true);
    setStatus('Analyzing video... This may take a moment.');
    setProgress(0);

    if (!poseDetectorRef.current) {
      poseDetectorRef.current = new PoseDetector();
      await poseDetectorRef.current.initialize();
    }

    const video = analysisVideoRef.current;
    video.currentTime = 0;

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
    const analyzedPoses = [];

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');

    const analyzeNextFrame = async () => {
      if (video.currentTime >= maxDuration - 0.1) {
        setStatus(`✅ Analysis complete! Analyzed ${analyzedPoses.length} frames.`);
        setProgress(100);
        
        const fileName = selectedFile.name.replace(/\.[^/.]+$/, '');
        const storageKey = `danceBattle_${fileName}`;
        
        try {
          await savePoses(storageKey, analyzedPoses);
          
          // Also download as JSON file (user should move to public/poses/)
          const fileName = storageKey.replace('danceBattle_', '') + '.json';
          const dataStr = JSON.stringify(analyzedPoses, null, 2);
          const blob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          setStatus(`✅ Saved ${analyzedPoses.length} poses! File downloaded: ${fileName}\n\n📁 Move this file to: public/poses/\n\nThe app will load from there automatically.`);
        } catch (error) {
          setStatus(`❌ Error saving: ${error.message}`);
        }
        
        setIsAnalyzing(false);
        return;
      }

      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const results = await poseDetectorRef.current.detectPoseOnly(canvas);
        const landmarks = poseDetectorRef.current.getPoseLandmarks(results);
        
        if (landmarks) {
          analyzedPoses.push(landmarks);
        }

        frameCount++;
        const progressPercent = Math.min(Math.floor((frameCount / totalFrames) * 100), 100);
        setProgress(progressPercent);
        setStatus(`Analyzing... ${progressPercent}% (${analyzedPoses.length} poses detected)`);

        const nextTime = Math.min(video.currentTime + frameInterval, maxDuration);
        video.currentTime = nextTime;
        
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

        await new Promise(r => setTimeout(r, 10));
        analyzeNextFrame();
      } catch (error) {
        console.error('Error analyzing frame:', error);
        video.currentTime = Math.min(video.currentTime + frameInterval, maxDuration);
        await new Promise(r => setTimeout(r, 50));
        analyzeNextFrame();
      }
    };

    await new Promise(resolve => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        setTimeout(resolve, 100);
      };
      video.addEventListener('seeked', onSeeked, { once: true });
    });

    analyzeNextFrame();
  };

  return (
    <div className="analysis-section">
      <h2>📹 Video Analysis Tool</h2>
      <div className="analysis-controls">
        <input 
          type="file" 
          ref={videoFileInputRef}
          accept="video/*" 
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        <button 
          className="btn btn-primary"
          onClick={() => videoFileInputRef.current?.click()}
          disabled={isAnalyzing}
        >
          Select Video File
        </button>
        {selectedFile && (
          <span className="file-name">{selectedFile.name}</span>
        )}
        <button 
          className="btn btn-primary"
          onClick={analyzeVideo}
          disabled={!selectedFile || isAnalyzing}
        >
          Analyze & Save
        </button>
        <button 
          className="btn btn-secondary"
          onClick={onClose}
          disabled={isAnalyzing}
        >
          Close
        </button>
      </div>
      <div className="analysis-preview">
        <video 
          ref={analysisVideoRef}
          controls 
          style={{ display: 'none', maxWidth: '100%' }}
        />
      </div>
      <div className="analysis-status">{status}</div>
      {isAnalyzing && (
        <div className="analysis-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              ref={progressFillRef}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="progress-text" ref={progressTextRef}>{progress}%</div>
        </div>
      )}
    </div>
  );
}

