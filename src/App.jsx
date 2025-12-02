import { useState, useEffect, useRef } from 'react';
import { PoseDetector } from './utils/poseDetector';
import { MovementComparer } from './utils/movementComparer';
import { checkPoseData, loadPoseData, savePoseData } from './utils/api';
import './App.css';

const VIDEO_NAME = 'dancetwo';
const TARGET_SCORE = 1000;

function App() {
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState('Initializing...');
  const [isRunning, setIsRunning] = useState(false);
  const [referencePoses, setReferencePoses] = useState([]);
  
  const referenceVideoRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const referenceCanvasRef = useRef(null);
  const cameraCanvasRef = useRef(null);
  const matchOverlayRef = useRef(null);
  const matchIndicatorRef = useRef(null);
  
  const poseDetectorRef = useRef(null);
  const movementComparerRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const isRunningRef = useRef(false);
  const overlayLoopRef = useRef(null);
  const comparisonLoopRef = useRef(null);

  useEffect(() => {
    // Initialize pose detector
    poseDetectorRef.current = new PoseDetector();
    movementComparerRef.current = new MovementComparer();
    
    // Load MediaPipe scripts
    const scripts = [
      'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js'
    ];
    
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.crossOrigin = 'anonymous';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };
    
    Promise.all(scripts.map(loadScript)).then(() => {
      console.log('MediaPipe scripts loaded');
      initializePoseData();
    }).catch((error) => {
      console.error('Error loading MediaPipe scripts:', error);
      setStatus('Error loading MediaPipe. Please refresh the page.');
    });
    
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const initializePoseData = async () => {
    setStatus('Checking for saved pose data...');
    
    try {
      const exists = await checkPoseData(VIDEO_NAME);
      
      if (exists) {
        setStatus('Loading saved pose data...');
        const poses = await loadPoseData(VIDEO_NAME);
        if (poses && poses.length > 0) {
          setReferencePoses(poses);
          movementComparerRef.current.setReferencePoses(poses);
          setStatus(`✅ Loaded ${poses.length} saved poses - Ready!`);
          return;
        }
      }
      
      // Need to analyze
      setStatus('Pose data not found. Will analyze on first start.');
    } catch (error) {
      console.error('Error initializing pose data:', error);
      setStatus('Error checking pose data. Will analyze on first start.');
    }
  };

  const analyzeReferenceVideo = async () => {
    const video = referenceVideoRef.current;
    if (!video) return;

    const poses = [];
    const fps = 30;
    const frameInterval = 1 / fps;
    const maxDuration = video.duration;
    
    const analysisCanvas = document.createElement('canvas');
    analysisCanvas.width = video.videoWidth || 640;
    analysisCanvas.height = video.videoHeight || 480;
    const analysisCtx = analysisCanvas.getContext('2d');
    
    video.currentTime = 0;
    
    return new Promise((resolve, reject) => {
      const analyzeNextFrame = async () => {
        if (video.currentTime >= maxDuration - 0.1) {
          setReferencePoses(poses);
          movementComparerRef.current.setReferencePoses(poses);
          
          // Save to database
          try {
            await savePoseData(VIDEO_NAME, poses);
            setStatus(`✅ Analyzed and saved ${poses.length} poses!`);
          } catch (error) {
            console.error('Error saving to database:', error);
            setStatus(`Analyzed ${poses.length} poses (save failed)`);
          }
          
          resolve();
          return;
        }

        try {
          analysisCtx.drawImage(video, 0, 0, analysisCanvas.width, analysisCanvas.height);
          
          const results = await poseDetectorRef.current.detectPoseOnly(analysisCanvas);
          const landmarks = poseDetectorRef.current.getPoseLandmarks(results);
          
          if (landmarks) {
            poses.push(landmarks);
          }

          const progress = Math.floor((video.currentTime / maxDuration) * 100);
          setStatus(`Analyzing reference dance... ${progress}%`);

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
            }, 100);
          });
          
          await new Promise(resolve => setTimeout(resolve, 20));
          analyzeNextFrame();
        } catch (error) {
          console.error('Error analyzing frame:', error);
          video.currentTime = Math.min(video.currentTime + frameInterval, maxDuration);
          await new Promise(resolve => setTimeout(resolve, 50));
          analyzeNextFrame();
        }
      };

      video.addEventListener('seeked', () => {
        setTimeout(() => analyzeNextFrame(), 100);
      }, { once: true });
    });
  };

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      }
    });

    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = stream;
      cameraStreamRef.current = stream;
    }
  };

  const start = async () => {
    if (isRunning) return;

    setStatus('Initializing camera...');
    
    try {
      await poseDetectorRef.current.initialize();
      await startCamera();

      if (referencePoses.length === 0) {
        setStatus('Analyzing reference dance (this only happens once)...');
        await analyzeReferenceVideo();
        
        if (referencePoses.length === 0) {
          setStatus('Error: No poses detected');
          return;
        }
      }

      setStatus('Dance battle started! Follow the moves!');
      setIsRunning(true);
      isRunningRef.current = true;
      
      if (referenceVideoRef.current) {
        referenceVideoRef.current.play();
      }

      // Wait a bit for video to be ready
      setTimeout(() => {
        startReferenceOverlayLoop();
        startComparisonLoop();
      }, 500);
    } catch (error) {
      console.error('Error starting app:', error);
      setStatus('Error: ' + error.message);
    }
  };

  const stop = () => {
    setIsRunning(false);
    isRunningRef.current = false;
    setScore(0);
    
    // Cancel animation loops
    if (overlayLoopRef.current) {
      cancelAnimationFrame(overlayLoopRef.current);
      overlayLoopRef.current = null;
    }
    if (comparisonLoopRef.current) {
      cancelAnimationFrame(comparisonLoopRef.current);
      comparisonLoopRef.current = null;
    }
    
    if (referenceVideoRef.current) {
      referenceVideoRef.current.pause();
    }
    
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }

    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }

    setStatus('Stopped');
    hideMatchFeedback();
  };

  const startReferenceOverlayLoop = () => {
    // Cancel existing loop if any
    if (overlayLoopRef.current) {
      cancelAnimationFrame(overlayLoopRef.current);
    }

    const loop = () => {
      if (!isRunningRef.current) return;

      const video = referenceVideoRef.current;
      const canvas = referenceCanvasRef.current;
      
      if (video && canvas && referencePoses.length > 0 && video.duration > 0 && !video.paused) {
        const videoTime = video.currentTime;
        const videoDuration = video.duration;
        const frameIndex = Math.floor(
          (videoTime / videoDuration) * referencePoses.length
        ) % referencePoses.length;
        
        const referenceLandmarks = referencePoses[frameIndex];
        if (referenceLandmarks && poseDetectorRef.current) {
          poseDetectorRef.current.drawStoredLandmarks(referenceLandmarks, canvas);
        }
      }

      overlayLoopRef.current = requestAnimationFrame(loop);
    };
    
    loop();
  };

  const startComparisonLoop = () => {
    // Cancel existing loop if any
    if (comparisonLoopRef.current) {
      cancelAnimationFrame(comparisonLoopRef.current);
    }

    const loop = async () => {
      if (!isRunningRef.current) return;

      comparisonLoopRef.current = requestAnimationFrame(loop);

      try {
        const cameraVideo = cameraVideoRef.current;
        const cameraCanvas = cameraCanvasRef.current;
        
        if (!cameraVideo || !cameraCanvas || cameraVideo.readyState < 2) {
          return;
        }

        if (!poseDetectorRef.current) {
          console.error('Pose detector not initialized');
          return;
        }

        const cameraResults = await poseDetectorRef.current.detectPose(cameraVideo, cameraCanvas);
        const userLandmarks = poseDetectorRef.current.getPoseLandmarks(cameraResults);

        const video = referenceVideoRef.current;
        if (video && referencePoses.length > 0 && video.duration > 0) {
          const videoTime = video.currentTime;
          const videoDuration = video.duration;
          const frameIndex = Math.floor(
            (videoTime / videoDuration) * referencePoses.length
          ) % referencePoses.length;
          
          const referenceLandmarks = referencePoses[frameIndex];

          if (userLandmarks && referenceLandmarks) {
            const similarity = movementComparerRef.current.comparePoses(
              userLandmarks, 
              referenceLandmarks
            );

            showMatchFeedback(similarity);

            const points = Math.floor(similarity * 10);
            if (points > 0) {
              setScore(prev => {
                const newScore = Math.min(prev + points, TARGET_SCORE);
                if (newScore >= TARGET_SCORE) {
                  setStatus('🎉 You Win! Great dancing! 🎉');
                  setTimeout(() => stop(), 1000);
                }
                return newScore;
              });
            }
          }
        }
      } catch (error) {
        console.error('Error in comparison loop:', error);
      }
    };
    
    loop();
  };

  const showMatchFeedback = (similarity) => {
    if (similarity > 0.7) {
      if (similarity > 0.9 && matchIndicatorRef.current) {
        matchIndicatorRef.current.classList.add('active');
        setTimeout(() => {
          if (matchIndicatorRef.current) {
            matchIndicatorRef.current.classList.remove('active');
          }
        }, 500);
      }
      
      if (matchOverlayRef.current) {
        matchOverlayRef.current.classList.add('active');
        setTimeout(() => {
          if (matchOverlayRef.current) {
            matchOverlayRef.current.classList.remove('active');
          }
        }, 300);
      }
    }
  };

  const hideMatchFeedback = () => {
    if (matchIndicatorRef.current) {
      matchIndicatorRef.current.classList.remove('active');
    }
    if (matchOverlayRef.current) {
      matchOverlayRef.current.classList.remove('active');
    }
  };

  return (
    <div className="container">
      <header>
        <h1>🎵 Dance Battle 🎵</h1>
        <div className="score-display">
          <div className="score-label">Score</div>
          <div className="score-value">{Math.floor(score)}</div>
          <div className="score-target">Target: <span>{TARGET_SCORE}</span></div>
        </div>
      </header>

      <div className="main-content">
        <div className="video-section">
          <h2>Reference Dance</h2>
          <div className="video-wrapper">
            <video 
              ref={referenceVideoRef}
              src="/dancetwo.mp4" 
              muted 
              loop
            />
            <canvas ref={referenceCanvasRef} />
          </div>
        </div>

        <div className="camera-section">
          <h2>Your Dance</h2>
          <div className="video-wrapper">
            <video 
              ref={cameraVideoRef}
              autoPlay 
              playsInline
              className="camera-video"
            />
            <canvas ref={cameraCanvasRef} className="camera-canvas" />
            <div ref={matchOverlayRef} className="match-overlay" />
          </div>
        </div>
      </div>

      <div className="controls">
        <button 
          className="btn btn-primary" 
          onClick={start}
          disabled={isRunning}
        >
          Start Battle
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={stop}
          disabled={!isRunning}
        >
          Stop
        </button>
      </div>

      <div className="status">{status}</div>

      <div ref={matchIndicatorRef} className="match-indicator">
        <div className="match-flash"></div>
        <div className="match-text">GREAT!</div>
      </div>
    </div>
  );
}

export default App;

