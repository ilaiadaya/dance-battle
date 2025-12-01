#!/usr/bin/env node

/**
 * Step 2: Process extracted frames with TensorFlow.js pose detection
 * Reads frames from temp-frames/ and processes them
 * 
 * Usage: npm run process-frames
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import * as tf from '@tensorflow/tfjs-node';
import * as poseDetection from '@tensorflow-models/pose-detection';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const publicDir = join(projectRoot, 'public');
const posesDir = join(publicDir, 'poses');
const framesDir = join(projectRoot, 'temp-frames');

// Load DATABASE_URL from .env if available
let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  try {
    const envPath = join(projectRoot, '.env');
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, 'utf8');
      const match = envContent.match(/DATABASE_URL=(.+)/);
      if (match) {
        databaseUrl = match[1].trim();
      }
    }
  } catch (error) {
    // Ignore
  }
}

const useDatabase = !!databaseUrl;

console.log('🤖 Processing frames with TensorFlow.js (pure Node.js, no browser!)...\n');
if (useDatabase) {
  console.log('   Will save to files AND PostgreSQL\n');
} else {
  console.log('   Will save to files only\n');
}

// Process frames with TensorFlow.js pose detection
async function processFramesWithTF(frames, videoName) {
  console.log(`🤖 Processing ${frames.length} frames for ${videoName}...`);
  
  // Load pose detection model
  const detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      enableSmoothing: true,
      minPoseScore: 0.25
    }
  );
  
  const poses = [];
  const framesPath = join(framesDir, videoName);
  
  // Get image dimensions from first frame for normalization
  let imageWidth = 640;
  let imageHeight = 480;
  try {
    const firstFramePath = join(framesPath, frames[0]);
    const firstImageBuffer = readFileSync(firstFramePath);
    const firstImageTensor = tf.node.decodeImage(firstImageBuffer, 3);
    imageWidth = firstImageTensor.shape[1];
    imageHeight = firstImageTensor.shape[0];
    firstImageTensor.dispose();
  } catch (error) {
    console.warn(`   Warning: Could not get image dimensions, using defaults`);
  }
  
  for (let i = 0; i < frames.length; i++) {
    const frameFile = frames[i];
    const framePath = join(framesPath, frameFile);
    
    try {
      // Load image as tensor
      const imageBuffer = readFileSync(framePath);
      const imageTensor = tf.node.decodeImage(imageBuffer, 3);
      
      // Update dimensions from actual image
      if (imageTensor.shape[1] && imageTensor.shape[0]) {
        imageWidth = imageTensor.shape[1];
        imageHeight = imageTensor.shape[0];
      }
      
      // Detect pose
      const pose = await detector.estimatePoses(imageTensor);
      
      // Convert to MediaPipe format (33 landmarks) with normalized coordinates
      if (pose && pose.length > 0) {
        const landmarks = convertToMediaPipeFormat(pose[0], imageWidth, imageHeight);
        if (landmarks) {
          poses.push(landmarks);
        }
      }
      
      // Dispose tensor to free memory
      imageTensor.dispose();
      
      // Progress update
      if ((i + 1) % 100 === 0 || i === frames.length - 1) {
        const progress = Math.floor(((i + 1) / frames.length) * 100);
        console.log(`   ${videoName}: ${progress}% (${poses.length} poses detected)`);
      }
    } catch (error) {
      console.warn(`   Warning: Failed to process frame ${frameFile}: ${error.message}`);
    }
  }
  
  // Cleanup
  detector.dispose();
  
  console.log(`✅ ${videoName}: Processed ${frames.length} frames, detected ${poses.length} poses\n`);
  return poses;
}

// Convert MoveNet pose to MediaPipe format (33 landmarks)
// MediaPipe uses normalized coordinates (0-1), so we need to normalize MoveNet's pixel coordinates
function convertToMediaPipeFormat(pose, imageWidth, imageHeight) {
  // MoveNet has 17 keypoints, MediaPipe has 33
  // We'll map the key points and set others to 0
  const keypointMap = {
    0: 0,   // nose
    1: 2,   // left eye
    2: 5,   // right eye
    3: 7,   // left ear
    4: 8,   // right ear
    5: 11,  // left shoulder
    6: 12,  // right shoulder
    7: 13,  // left elbow
    8: 14,  // right elbow
    9: 15,  // left wrist
    10: 16, // right wrist
    11: 23, // left hip
    12: 24, // right hip
    13: 25, // left knee
    14: 26, // right knee
    15: 27, // left ankle
    16: 28  // right ankle
  };
  
  const landmarks = new Array(33).fill(null).map(() => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0
  }));
  
  if (!pose.keypoints || pose.keypoints.length === 0) {
    return null;
  }
  
  pose.keypoints.forEach((kp, idx) => {
    const mediaPipeIdx = keypointMap[idx];
    if (mediaPipeIdx !== undefined) {
      // MoveNet returns pixel coordinates, MediaPipe uses normalized (0-1)
      // Normalize coordinates to match MediaPipe format
      const normalizedX = kp.x / imageWidth;
      const normalizedY = kp.y / imageHeight;
      
      landmarks[mediaPipeIdx] = {
        x: normalizedX,
        y: normalizedY,
        z: kp.z ? kp.z / imageWidth : 0, // Normalize z as well if present
        visibility: kp.score || 1.0
      };
    }
  });
  
  return landmarks;
}

// Save poses to files and optionally to database
async function savePoses(poses, videoName) {
  // Always save to files first
  if (!existsSync(posesDir)) {
    mkdirSync(posesDir, { recursive: true });
  }
  
  const filePath = join(posesDir, `${videoName}.json`);
  writeFileSync(filePath, JSON.stringify(poses, null, 2), 'utf8');
  console.log(`✅ Saved ${poses.length} poses → ${filePath}`);
  
  // Optionally save to PostgreSQL
  if (useDatabase) {
    try {
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: databaseUrl,
        ssl: databaseUrl.includes('railway') || databaseUrl.includes('sslmode=require') 
          ? { rejectUnauthorized: false } 
          : false,
        connectionTimeoutMillis: 5000
      });
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS poses (
          key VARCHAR(255) PRIMARY KEY,
          data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await pool.query(
        `INSERT INTO poses (key, data, updated_at) 
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (key) 
         DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP`,
        [`danceBattle_${videoName}`, JSON.stringify(poses)]
      );
      
      console.log(`✅ Saved ${poses.length} poses → PostgreSQL (danceBattle_${videoName})`);
      await pool.end();
    } catch (dbError) {
      console.warn(`⚠️  Could not save to database: ${dbError.message}`);
      console.warn('   But local files are saved, so you can test locally!\n');
    }
  }
}

async function main() {
  // Check if frames exist (process any that are available)
  const danceoneFramesDir = join(framesDir, 'danceone');
  const dancetwoFramesDir = join(framesDir, 'dancetwo');
  
  const hasDanceone = existsSync(danceoneFramesDir);
  const hasDancetwo = existsSync(dancetwoFramesDir);
  
  if (!hasDanceone && !hasDancetwo) {
    console.error('❌ Error: No frames found. Run: npm run extract-frames first');
    process.exit(1);
  }
  
  const frames1 = hasDanceone ? readdirSync(danceoneFramesDir).filter(f => f.endsWith('.png')).sort() : [];
  const frames2 = hasDancetwo ? readdirSync(dancetwoFramesDir).filter(f => f.endsWith('.png')).sort() : [];
  
  if (frames1.length === 0 && frames2.length === 0) {
    console.error('❌ Error: No frames found. Run: npm run extract-frames first');
    process.exit(1);
  }
  
  if (frames1.length > 0) {
    console.log(`📁 Found ${frames1.length} frames for danceone`);
  }
  if (frames2.length > 0) {
    console.log(`📁 Found ${frames2.length} frames for dancetwo`);
  }
  console.log('');
  
  try {
    // Process danceone if frames exist
    if (frames1.length > 0) {
      console.log('📹 Processing danceone frames...\n');
      const poses1 = await processFramesWithTF(frames1, 'danceone');
      await savePoses(poses1, 'danceone');
      console.log('');
    }
    
    // Process dancetwo if frames exist
    if (frames2.length > 0) {
      console.log('📹 Processing dancetwo frames...\n');
      const poses2 = await processFramesWithTF(frames2, 'dancetwo');
      await savePoses(poses2, 'dancetwo');
    }
    
    console.log('\n✅ All done! Pose data saved to files.');
    if (useDatabase) {
      console.log('   Also saved to PostgreSQL.\n');
    } else {
      console.log('   Add DATABASE_URL to .env to also save to PostgreSQL.\n');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

