import express from 'express';
import { getPool } from '../db.js';

const router = express.Router();

// Get pose data for a video
router.get('/:videoName', async (req, res) => {
  try {
    const { videoName } = req.params;
    const pool = getPool();
    
    const result = await pool.query(
      'SELECT poses, frame_count FROM pose_data WHERE video_name = $1',
      [videoName]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pose data not found' });
    }
    
    res.json({
      poses: result.rows[0].poses,
      frameCount: result.rows[0].frame_count
    });
  } catch (error) {
    console.error('Error fetching pose data:', error);
    res.status(500).json({ error: 'Failed to fetch pose data' });
  }
});

// Save pose data for a video
router.post('/:videoName', async (req, res) => {
  try {
    const { videoName } = req.params;
    const { poses, frameCount } = req.body;
    
    if (!poses || !Array.isArray(poses)) {
      return res.status(400).json({ error: 'Invalid poses data' });
    }
    
    const pool = getPool();
    
    const result = await pool.query(
      `INSERT INTO pose_data (video_name, poses, frame_count)
       VALUES ($1, $2, $3)
       ON CONFLICT (video_name) 
       DO UPDATE SET poses = $2, frame_count = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING id, frame_count`,
      [videoName, JSON.stringify(poses), frameCount || poses.length]
    );
    
    res.json({
      success: true,
      id: result.rows[0].id,
      frameCount: result.rows[0].frame_count
    });
  } catch (error) {
    console.error('Error saving pose data:', error);
    res.status(500).json({ error: 'Failed to save pose data' });
  }
});

// Check if pose data exists
router.head('/:videoName', async (req, res) => {
  try {
    const { videoName } = req.params;
    const pool = getPool();
    
    const result = await pool.query(
      'SELECT COUNT(*) FROM pose_data WHERE video_name = $1',
      [videoName]
    );
    
    const exists = parseInt(result.rows[0].count) > 0;
    res.status(exists ? 200 : 404).json({ exists });
  } catch (error) {
    console.error('Error checking pose data:', error);
    res.status(500).json({ error: 'Failed to check pose data' });
  }
});

export default router;

