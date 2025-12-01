#!/usr/bin/env node

/**
 * Step 1: Extract frames from videos using ffmpeg
 * This saves frames to temp-frames/ so they can be reused
 * 
 * Usage: npm run extract-frames
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readdirSync, unlinkSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const publicDir = join(projectRoot, 'public');
const framesDir = join(projectRoot, 'temp-frames');

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
    console.log(`✅ Extracted ${frames.length} frames to ${outputDir}\n`);
    return frames;
  } catch (error) {
    console.error(`❌ Error extracting frames: ${error.message}`);
    throw error;
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
  
  console.log('🎬 Extracting frames from videos...\n');
  
  try {
    // Extract frames for danceone
    console.log('📹 Processing danceone.mp4...');
    const frames1 = extractFrames(danceonePath, join(framesDir, 'danceone'), 30);
    console.log(`✅ danceone: ${frames1.length} frames extracted\n`);
    
    // Extract frames for dancetwo
    console.log('📹 Processing dancetwo.mp4...');
    const frames2 = extractFrames(dancetwoPath, join(framesDir, 'dancetwo'), 30);
    console.log(`✅ dancetwo: ${frames2.length} frames extracted\n`);
    
    console.log('✅ All frames extracted!');
    console.log(`   Frames saved to: ${framesDir}/`);
    console.log('   Run: npm run process-frames to process them\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

