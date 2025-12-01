import { useState, useEffect } from 'react';
import DanceBattle from './components/DanceBattle';
import VideoAnalyzer from './components/VideoAnalyzer';
import './App.css';

function App() {
  const [showAnalyzer, setShowAnalyzer] = useState(false);

  return (
    <div className="app">
      {!showAnalyzer ? (
        <DanceBattle onShowAnalyzer={() => setShowAnalyzer(true)} />
      ) : (
        <VideoAnalyzer onClose={() => setShowAnalyzer(false)} />
      )}
    </div>
  );
}

export default App;

