#!/usr/bin/env node

/**
 * Preprocess videos using pure Node.js - no browser needed!
 * Step 1: Extract frames with ffmpeg
 * Step 2: Process frames with TensorFlow.js pose detection
 * Step 3: Save to files (and optionally PostgreSQL)
 * 
 * Usage: npm run preprocess-nodejs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
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

console.log('🎬 Preprocessing videos with pure Node.js (no browser needed!)...\n');
if (useDatabase) {
  console.log('   Will save to files AND PostgreSQL\n');
} else {
  console.log('   Will save to files only\n');
}

// Check if ffmpeg is available
function checkFFmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Extract frames from video using ffmpeg
function extractFrames(videoPath, outputDir, fps = 30) {
  console.log(`📹 Extracting frames from ${videoPath} at ${fps} fps...`);
  
  // Clean output directory
  if (existsSync(outputDir)) {
    const files = readdirSync(outputDir);
    files.forEach(file => unlinkSync(join(outputDir, file)));
  } else {
    mkdirSync(outputDir, { recursive: true });
  }
  
  try {
    // Extract frames using ffmpeg
    execSync(
      `ffmpeg -i "${videoPath}" -vf fps=${fps} "${join(outputDir, 'frame-%06d.png')}" -y`,
      { stdio: 'inherit' }
    );
    
    const frames = readdirSync(outputDir).filter(f => f.endsWith('.png')).sort();
    console.log(`✅ Extracted ${frames.length} frames\n`);
    return frames;
  } catch (error) {
    console.error(`❌ Error extracting frames: ${error.message}`);
    throw error;
  }
}

// Process frames with TensorFlow.js pose detection
async function processFramesWithTF(frames, videoName) {
  console.log(`🤖 Processing ${frames.length} frames with TensorFlow.js...`);
  
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
  
  for (let i = 0; i < frames.length; i++) {
    const frameFile = frames[i];
    const framePath = join(framesPath, frameFile);
    
    try {
      // Load image as tensor
      const imageBuffer = readFileSync(framePath);
      const imageTensor = tf.node.decodeImage(imageBuffer, 3);
      
      // Detect pose
      const pose = await detector.estimatePoses(imageTensor);
      
      // Convert to MediaPipe format (33 landmarks)
      if (pose && pose.length > 0) {
        const landmarks = convertToMediaPipeFormat(pose[0]);
        if (landmarks) {
          poses.push(landmarks);
        }
      }
      
      // Dispose tensor to free memory
      imageTensor.dispose();
      
      // Progress update
      if ((i + 1) % 100 === 0 || i === frames.length - 1) {
        const progress = Math.floor(((i + 1) / frames.length) * 100);
        console.log(`   Progress: ${progress}% (${poses.length} poses detected)`);
      }
    } catch (error) {
      console.warn(`   Warning: Failed to process frame ${frameFile}: ${error.message}`);
    }
  }
  
  // Cleanup
  detector.dispose();
  
  console.log(`✅ Processed ${frames.length} frames, detected ${poses.length} poses\n`);
  return poses;
}

// Convert MoveNet pose to MediaPipe format (33 landmarks)
function convertToMediaPipeFormat(pose) {
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
      landmarks[mediaPipeIdx] = {
        x: kp.x,
        y: kp.y,
        z: kp.z || 0,
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

// Clean up temp frames
function cleanupFrames(dir) {
  if (existsSync(dir)) {
    const files = readdirSync(dir);
    files.forEach(file => unlinkSync(join(dir, file)));
  }
}

async function main() {
  if (!checkFFmpeg()) {
    console.error('❌ Error: ffmpeg is not installed');
    console.error('   Install it: brew install ffmpeg (macOS) or apt-get install ffmpeg (Linux)');
    process.exit(1);
  }
  
  const danceonePath = join(publicDir, 'danceone.mp4');
  const dancetwoPath = join(publicDir, 'dancetwo.mp4');
  
  if (!existsSync(danceonePath) || !existsSync(dancetwoPath)) {
    console.error('❌ Error: Video files not found in public/ directory');
    process.exit(1);
  }
  
  try {
    // Process danceone
    console.log('📹 Processing danceone.mp4...\n');
    const frames1 = extractFrames(danceonePath, join(framesDir, 'danceone'), 30);
    const poses1 = await processFramesWithTF(frames1, 'danceone');
    await savePoses(poses1, 'danceone');
    cleanupFrames(join(framesDir, 'danceone'));
    console.log('');
    
    // Process dancetwo
    console.log('📹 Processing dancetwo.mp4...\n');
    const frames2 = extractFrames(dancetwoPath, join(framesDir, 'dancetwo'), 30);
    const poses2 = await processFramesWithTF(frames2, 'dancetwo');
    await savePoses(poses2, 'dancetwo');
    cleanupFrames(join(framesDir, 'dancetwo'));
    
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

