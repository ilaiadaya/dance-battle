const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

export async function checkPoseData(videoName) {
  try {
    const response = await fetch(`${API_BASE}/poses/${videoName}`, {
      method: 'HEAD'
    });
    return response.ok;
  } catch (error) {
    console.error('Error checking pose data:', error);
    return false;
  }
}

export async function loadPoseData(videoName) {
  try {
    const response = await fetch(`${API_BASE}/poses/${videoName}`);
    if (!response.ok) {
      throw new Error('Failed to load pose data');
    }
    const data = await response.json();
    return data.poses;
  } catch (error) {
    console.error('Error loading pose data:', error);
    return null;
  }
}

export async function savePoseData(videoName, poses) {
  try {
    const response = await fetch(`${API_BASE}/poses/${videoName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        poses,
        frameCount: poses.length
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to save pose data');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error saving pose data:', error);
    throw error;
  }
}

