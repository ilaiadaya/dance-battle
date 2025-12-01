import { useState, useEffect } from 'react';
import DanceBattle from './components/DanceBattle';
import VideoAnalyzer from './components/VideoAnalyzer';
import './App.css';

function App() {
  const [showAnalyzer, setShowAnalyzer] = useState(false);

  return (
    <div className="app">
      <DanceBattle />
    </div>
  );
}

export default App;

