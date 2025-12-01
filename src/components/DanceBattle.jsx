import { useState, useEffect, useRef } from 'react';
import { PoseDetector } from '../utils/poseDetector';
import { MovementComparer } from '../utils/movementComparer';
import { loadPoses, savePoses } from '../utils/storage';

export default function DanceBattle() {
  const [score, setScore] = useState(0);
  const [targetScore] = useState(1000);
  const [status, setStatus] = useState('Ready to start');
  const [isRunning, setIsRunning] = useState(false);
  const [referencePoses, setReferencePoses] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState('dancetwo');

  const referenceVideoRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const referenceCanvasRef = useRef(null);
  const cameraCanvasRef = useRef(null);
  const matchOverlayRef = useRef(null);
  const matchIndicatorRef = useRef(null);

  const poseDetectorRef = useRef(null);
  const movementComparerRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const comparisonLoopRef = useRef(null);

  useEffect(() => {
    // Initialize pose detector and movement comparer
    poseDetectorRef.current = new PoseDetector();
    movementComparerRef.current = new MovementComparer();

    // Load saved poses on mount
    loadSavedPoses();

    return () => {
      // Cleanup
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (comparisonLoopRef.current) {
        clearTimeout(comparisonLoopRef.current);
      }
    };
  }, []);

  // Reload poses when video selection changes
  useEffect(() => {
    if (poseDetectorRef.current && movementComparerRef.current) {
      loadSavedPoses();
    }
  }, [selectedVideo]);

  const loadSavedPoses = async () => {
    const key = `danceBattle_${selectedVideo}`;
    setStatus('Loading pose data...');
    
    try {
      const savedPoses = await loadPoses(key);
      if (savedPoses && savedPoses.length > 0) {
        setReferencePoses(savedPoses);
        movementComparerRef.current.setReferencePoses(savedPoses);
        setStatus(`✅ Loaded ${savedPoses.length} saved poses - Ready!`);
      } else {
        setStatus(`❌ No saved poses found for ${selectedVideo}. Run: npm run preprocess-files`);
      }
    } catch (error) {
      console.error('Error loading poses:', error);
      setStatus(`❌ Error loading poses: ${error.message}`);
    }
  };

  const start = async () => {
    if (isRunning) return;

    setStatus('Initializing camera...');

    try {
      await poseDetectorRef.current.initialize();

      // Start camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      cameraVideoRef.current.srcObject = stream;
      cameraStreamRef.current = stream;
      
      // Ensure video plays
      await new Promise((resolve) => {
        cameraVideoRef.current.onloadedmetadata = () => {
          cameraVideoRef.current.play().catch(err => {
            console.warn('Camera video autoplay failed:', err);
          });
          resolve();
        };
      });

      // Check if we have poses
      if (referencePoses.length === 0) {
        const key = `danceBattle_${selectedVideo}`;
        const savedPoses = await loadPoses(key);
        if (savedPoses && savedPoses.length > 0) {
          setReferencePoses(savedPoses);
          movementComparerRef.current.setReferencePoses(savedPoses);
          setStatus(`✅ Loaded ${savedPoses.length} saved poses - Ready!`);
        } else {
          setStatus('❌ No saved poses found. Please analyze the video first using "Analyze Video".');
          return;
        }
      }

      setStatus('Dance battle started! Follow the moves!');
      setIsRunning(true);
      referenceVideoRef.current.play();

      // Wait for reference video to be ready
      await new Promise((resolve) => {
        if (referenceVideoRef.current.readyState >= 2) {
          resolve();
        } else {
          referenceVideoRef.current.onloadedmetadata = resolve;
        }
      });
      
      // Start overlay loop for reference video
      const overlayLoop = () => {
        if (!isRunning) {
          return;
        }
        
        const video = referenceVideoRef.current;
        const canvas = referenceCanvasRef.current;
        const videoTime = video?.currentTime || 0;
        const videoDuration = video?.duration || 0;
        
        if (referencePoses.length > 0 && videoDuration > 0 && canvas && video) {
          // Ensure canvas is sized correctly
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
          }
          
          const frameIndex = Math.floor(
            (videoTime / videoDuration) * referencePoses.length
          ) % referencePoses.length;
          
          const referenceLandmarks = referencePoses[frameIndex];
          if (referenceLandmarks && poseDetectorRef.current && canvas.width > 0 && canvas.height > 0) {
            // Debug log first few frames
            if (frameIndex < 3) {
              console.log('Drawing reference pose:', {
                frameIndex,
                landmarksCount: referenceLandmarks?.length,
                canvasSize: `${canvas.width}x${canvas.height}`,
                videoSize: `${video.videoWidth}x${video.videoHeight}`,
                firstLandmark: referenceLandmarks?.[0]
              });
            }
            poseDetectorRef.current.drawStoredLandmarks(referenceLandmarks, canvas);
          } else {
            if (frameIndex < 3) {
              console.warn('Cannot draw reference pose:', {
                hasLandmarks: !!referenceLandmarks,
                hasDetector: !!poseDetectorRef.current,
                canvasSize: `${canvas?.width}x${canvas?.height}`,
                videoSize: `${video?.videoWidth}x${video?.videoHeight}`
              });
            }
          }
        }

        requestAnimationFrame(overlayLoop);
      };
      overlayLoop();
      
      // Start comparison loop
      startComparisonLoop();
    } catch (error) {
      console.error('Error starting app:', error);
      setStatus('Error: ' + error.message);
    }
  };

  const stop = () => {
    setIsRunning(false);
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

    if (comparisonLoopRef.current) {
      clearTimeout(comparisonLoopRef.current);
    }

    setStatus('Stopped');
    setScore(0);
    hideMatchFeedback();
  };

  const startReferenceOverlayLoop = () => {
    if (!isRunning) {
      return;
    }

    const videoTime = referenceVideoRef.current?.currentTime || 0;
    const videoDuration = referenceVideoRef.current?.duration || 0;
    
    if (referencePoses.length > 0 && videoDuration > 0 && referenceCanvasRef.current) {
      const frameIndex = Math.floor(
        (videoTime / videoDuration) * referencePoses.length
      ) % referencePoses.length;
      
      const referenceLandmarks = referencePoses[frameIndex];
      if (referenceLandmarks && poseDetectorRef.current) {
        poseDetectorRef.current.drawStoredLandmarks(referenceLandmarks, referenceCanvasRef.current);
      }
    }

    if (isRunning) {
      requestAnimationFrame(startReferenceOverlayLoop);
    }
  };

  const startComparisonLoop = async () => {
    if (!isRunning) return;

    try {
      if (cameraVideoRef.current?.readyState < 2) {
        comparisonLoopRef.current = setTimeout(startComparisonLoop, 100);
        return;
      }

      // Ensure camera canvas is sized correctly
      const cameraVideo = cameraVideoRef.current;
      const cameraCanvas = cameraCanvasRef.current;
      if (cameraVideo && cameraCanvas) {
        const videoWidth = cameraVideo.videoWidth || cameraVideo.offsetWidth || 640;
        const videoHeight = cameraVideo.videoHeight || cameraVideo.offsetHeight || 480;
        if (cameraCanvas.width !== videoWidth || cameraCanvas.height !== videoHeight) {
          cameraCanvas.width = videoWidth;
          cameraCanvas.height = videoHeight;
        }
      }

      const cameraResults = await poseDetectorRef.current.detectPose(
        cameraVideoRef.current, 
        cameraCanvasRef.current
      );
      const userLandmarks = poseDetectorRef.current.getPoseLandmarks(cameraResults);

      const videoTime = referenceVideoRef.current?.currentTime || 0;
      const videoDuration = referenceVideoRef.current?.duration || 0;
      
      if (referencePoses.length > 0 && videoDuration > 0) {
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
            setScore(prev => Math.min(prev + points, targetScore));
            
            if (score + points >= targetScore) {
              setStatus('🎉 You Win! Great dancing! 🎉');
              stop();
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in comparison loop:', error);
    }

    comparisonLoopRef.current = setTimeout(startComparisonLoop, 16); // ~60 fps
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
          <div className="score-target">Target: {targetScore}</div>
        </div>
      </header>

      <div className="video-selector" style={{ marginBottom: '20px', textAlign: 'center' }}>
        <label style={{ marginRight: '10px' }}>Reference Video:</label>
        <select 
          value={selectedVideo} 
          onChange={(e) => {
            setSelectedVideo(e.target.value);
            loadSavedPoses();
          }}
          disabled={isRunning}
          style={{ padding: '10px', fontSize: '1em', borderRadius: '5px' }}
        >
          <option value="danceone">Dance One</option>
          <option value="dancetwo">Dance Two</option>
        </select>
      </div>

      <div className="main-content">
        <div className="video-section">
          <h2>Reference Dance</h2>
          <div className="video-wrapper">
            <video 
              ref={referenceVideoRef}
              src={`/${selectedVideo}.mp4`}
              muted 
              loop
            />
            <canvas ref={referenceCanvasRef} />
          </div>
        </div>

        <div className="camera-section">
          <h2>Your Dance</h2>
          <div className="video-wrapper">
            <video ref={cameraVideoRef} autoplay playsInline muted />
            <canvas ref={cameraCanvasRef} />
            <div className="match-overlay" ref={matchOverlayRef} />
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

      <div className="match-indicator" ref={matchIndicatorRef}>
        <div className="match-flash"></div>
        <div className="match-text">GREAT!</div>
      </div>
    </div>
  );
}

