# Research Request: Dance Battle App Video Library

## Project Summary
I'm building an AI-powered dance battle web app where users follow reference dance videos using their webcam. The app uses MediaPipe Pose to detect body movements in real-time, overlays skeleton tracking on both the reference video and user's camera feed, and awards points based on movement similarity.

**Think: "Peloton for dancing" - users dance at home with just their laptop/phone camera.**

## What I Need

### Primary Request: Find Suitable Dance Videos

I need help finding high-quality dance videos that work well with pose detection technology. The videos should:

**Essential Requirements:**
- ✅ **Full body visible** (head to feet, not close-ups)
- ✅ **Front-facing or slight angle** (not side profiles)
- ✅ **Clean background** (solid colors or simple patterns work best)
- ✅ **Good lighting** (dancer clearly visible)
- ✅ **Clear movements** (not too subtle, defined choreography)
- ✅ **720p+ resolution** (1080p preferred)
- ✅ **30 seconds to 3 minutes** duration
- ✅ **Single dancer OR 2-4 synchronized dancers**

**What Works Well:**
- Dance tutorials (hip-hop, contemporary, K-pop, etc.)
- Fitness dance routines
- TikTok/Instagram dance challenges
- Choreographed routines
- Group dances (2-4 people)

**What Doesn't Work:**
- Close-ups or partial body shots
- Side profiles
- Crowded/busy backgrounds
- Low quality/blurry videos
- Very fast movements that detection might miss

### Research Tasks

1. **Video Discovery**
   - Find 20-30 high-quality dance videos from YouTube, TikTok, Instagram, or other sources
   - Focus on videos that are free to use (public domain, Creative Commons, or fair use)
   - Prioritize popular/trending dances for user appeal

2. **Video Analysis**
   - Rate each video on:
     - Pose detection suitability (1-10)
     - Background quality (1-10)
     - Movement clarity (1-10)
     - Overall usability (1-10)
   - Identify any issues (lighting, angles, etc.)

3. **Categorization**
   - Group by: difficulty, dance style, number of dancers, duration
   - Identify top 10-15 best candidates

4. **Feedback**
   - Explain why each recommended video works
   - Suggest any needed modifications
   - Note any licensing concerns

## Current Status

**Working Features:**
- Real-time pose detection and overlay
- Single-person and multi-person (up to 4) support
- Smooth 60fps playback with interpolation
- Scoring system with movement detection
- Database storage for analyzed poses

**Current Videos:**
- `dancetwo.mp4` - Single person
- `danceone.mp4` - Single person
- `wakwaka.mp4` - 4-person group (107MB)

## Technical Context

- **Pose Detection**: MediaPipe Pose (Google's ML solution)
- **Platform**: Web-based (works on desktop/mobile browsers)
- **Analysis**: Videos are pre-analyzed at 60fps, pose data stored in database
- **Performance**: Needs to run smoothly in browser, prefer videos < 50MB

## Questions to Answer

1. What are the best sources for finding suitable dance videos?
2. Are there specific YouTube channels/TikTok creators that consistently produce good content?
3. What dance styles work best for pose detection?
4. Copyright/licensing considerations?
5. What preprocessing (cropping, trimming) would help?
6. What makes a dance video "viral" or shareable?
7. Are there trends we should capitalize on?

## Output Format

Please provide:
- List of video URLs with metadata (title, creator, duration, etc.)
- Suitability scores and detailed reasoning
- Screenshots or timestamps of key moments
- Licensing information
- Download/preprocessing recommendations
- Top 10-15 recommendations with explanations

## Success Criteria

Perfect video would have:
- 9-10/10 pose detection suitability
- Clear, uncluttered background
- Full body visible throughout
- Engaging choreography
- Good video quality
- Reasonable file size
- No licensing concerns

---

**Goal**: Build a diverse library of high-quality dance videos that provide engaging, accurate pose detection experiences for users dancing at home.

