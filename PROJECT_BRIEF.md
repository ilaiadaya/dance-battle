# Dance Battle App - Project Brief for Research

## Overview
Dance Battle is an AI-powered web application that allows users to compete in real-time dance battles by following reference dance videos. The app uses computer vision (MediaPipe Pose) to analyze body movements and award points based on how well the user matches the reference dancer's movements.

## Core Concept
**"Peloton for dancing"** - Users can dance along with reference videos from home using just their laptop, phone, or tablet camera. The AI tracks their movements in real-time, compares them to the reference dancer, and awards points for accurate matches.

## How It Works

### Technical Stack
- **Frontend**: HTML5, CSS3, JavaScript (vanilla)
- **Pose Detection**: MediaPipe Pose (Google's ML solution)
- **Backend**: Node.js with Express
- **Database**: PostgreSQL (stores pre-analyzed pose data)
- **Deployment**: Railway

### User Flow
1. User opens the app and grants camera access
2. User selects a dance routine from available options
3. Reference video plays showing a dancer performing moves
4. User's camera feed is displayed side-by-side with the reference
5. AI overlays skeleton/pose detection on both videos in real-time
6. System compares user's pose to reference pose frame-by-frame
7. Points are awarded based on movement similarity (0-10 points per frame)
8. User accumulates points until reaching target (1000 points) or continues beyond
9. Visual feedback (green flashes) indicates good matches

### Key Features
- **Real-time pose detection**: Overlays skeleton on both reference and user video
- **Movement scoring**: Only awards points when reference dancer is actively moving
- **Multi-person support**: Can track up to 4 dancers simultaneously (for group routines)
- **Smooth playback**: 60fps analysis with frame interpolation for continuous overlay
- **Persistent storage**: Pre-analyzes videos once, stores pose data in database
- **Progress tracking**: Shows video progress bar and time to reach target score

## Video Requirements

### What Makes a Good Dance Battle Video?

#### Essential Criteria:
1. **Single or Multiple Clear Dancers**
   - Dancer(s) should be clearly visible throughout the video
   - Full body should be in frame (head to feet)
   - Minimal occlusion (dancers not blocking each other)
   - Good contrast between dancer and background

2. **Background Quality**
   - Clean, uncluttered backgrounds work best
   - Solid colors or simple patterns preferred
   - Avoid busy/complex backgrounds that confuse pose detection
   - Good lighting - dancer should be well-lit

3. **Camera Angle**
   - Front-facing or slight angle (not side profile)
   - Full body shot (not close-ups)
   - Stable camera (minimal shaking/movement)
   - Consistent framing throughout video

4. **Dance Characteristics**
   - Clear, defined movements (not too subtle)
   - Repetitive patterns or choreography
   - Movements that are achievable by users at home
   - Appropriate duration (30 seconds to 3 minutes ideal)

5. **Technical Quality**
   - Good resolution (720p minimum, 1080p preferred)
   - Smooth frame rate (30fps or higher)
   - Clear video quality (not blurry or pixelated)
   - Audio is nice but not required

#### Video Types That Work Well:
- **Dance tutorials** (hip-hop, contemporary, jazz, etc.)
- **Fitness dance routines** (Zumba, aerobics, etc.)
- **TikTok/Instagram dance challenges**
- **Choreographed routines** (K-pop, Bollywood, etc.)
- **Simple freestyle dances** with clear movements
- **Group dance routines** (2-4 people, synchronized)

#### Video Types to Avoid:
- **Extreme close-ups** (face only, upper body only)
- **Side profiles** (harder for pose detection)
- **Crowded scenes** (too many people, hard to isolate)
- **Very fast movements** (may be missed by detection)
- **Low quality/blurry videos**
- **Videos with heavy effects/filters** that obscure body
- **Dances requiring props** (can confuse pose detection)

## Current Implementation Status

### Working Features:
- ✅ Single-person dance battles
- ✅ Multi-person detection (up to 4 dancers)
- ✅ Real-time pose overlay with smooth interpolation
- ✅ Scoring system with movement detection
- ✅ Database storage for analyzed poses
- ✅ Video progress tracking
- ✅ Visual feedback for good matches

### Current Dance Library:
- `dancetwo.mp4` - Single person routine
- `danceone.mp4` - Single person routine  
- `wakwaka.mp4` - 4-person group routine (107MB)

## Research Request

### What We Need:

1. **Video Discovery**
   - Find high-quality dance videos that meet the criteria above
   - Sources: YouTube, TikTok, Instagram, dance tutorial sites, fitness channels
   - Focus on videos that are:
     - Free to use (public domain, Creative Commons, or fair use)
     - High quality (720p+)
     - Clear, full-body shots
     - Appropriate length (30s - 3min)
     - Popular/trending dances (for user appeal)

2. **Video Analysis**
   - Assess each video against the criteria
   - Rate videos on:
     - Pose detection suitability (1-10)
     - Background quality (1-10)
     - Movement clarity (1-10)
     - Overall usability (1-10)
   - Identify any potential issues (lighting, angles, etc.)

3. **Categorization**
   - Group videos by:
     - Difficulty level (beginner, intermediate, advanced)
     - Dance style (hip-hop, contemporary, K-pop, etc.)
     - Number of dancers (1, 2, 3, 4+)
     - Duration
     - Energy level (low, medium, high)

4. **Recommendations**
   - Top 10-20 videos that would work best
   - Explain why each video is suitable
   - Suggest any modifications needed (cropping, trimming, etc.)
   - Identify potential licensing issues

5. **Feedback on Current Videos**
   - Analyze the existing videos (dancetwo, danceone, wakwaka)
   - Suggest improvements or alternatives
   - Identify what makes them work (or not work)

### Output Format Requested:
- List of video URLs with metadata
- Suitability scores and reasoning
- Screenshots or timestamps of key moments
- Licensing information
- Download instructions (if applicable)
- Any preprocessing recommendations

## Technical Constraints

### Pose Detection Limitations:
- MediaPipe Pose works best with:
  - Front-facing or slight angle views
  - Full body visible
  - Good lighting
  - Minimal occlusion
  - Clear background contrast

### Performance Considerations:
- Video file size (prefer < 50MB for faster loading)
- Analysis time (60fps analysis takes time for long videos)
- Real-time processing (needs to run smoothly in browser)

### User Experience:
- Videos should be engaging and fun
- Appropriate for various skill levels
- Culturally diverse options
- Trending/popular dances increase appeal

## Success Metrics for Video Selection

A perfect video would have:
- ✅ 9-10/10 pose detection suitability
- ✅ Clear, uncluttered background
- ✅ Full body visible throughout
- ✅ Engaging, fun choreography
- ✅ Appropriate difficulty for target audience
- ✅ Good video quality (720p+)
- ✅ Reasonable file size
- ✅ No licensing concerns

## Questions to Answer

1. What are the best sources for finding dance videos that meet these criteria?
2. Are there specific YouTube channels, TikTok creators, or platforms that consistently produce suitable content?
3. What dance styles work best for pose detection?
4. Are there any copyright/licensing considerations we should be aware of?
5. What preprocessing steps (cropping, trimming, etc.) would improve video suitability?
6. Are there any trends in dance videos that we should capitalize on?
7. What makes a dance video "viral" or shareable that we could leverage?

## Additional Context

- Target audience: General public, all ages, various skill levels
- Use case: Home fitness, entertainment, social sharing
- Platform: Web-based (works on desktop and mobile)
- Future plans: Social features, leaderboards, user-uploaded dances

---

**Goal**: Build a diverse library of high-quality dance videos that provide engaging, accurate pose detection experiences for users.

