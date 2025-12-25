# How MediaPipe Pose Works - Math & Example

## Overview

MediaPipe Pose uses a **Convolutional Neural Network (CNN)** to detect human body keypoints in images/videos. Here's how it works:

## The Math Behind It

### 1. **Input Processing**
- Takes an image (e.g., 640x480 pixels)
- Resizes to model input size (typically 256x256 or 224x224)
- Normalizes pixel values to [0, 1] range

### 2. **Neural Network Processing**
The CNN has multiple layers that:
- Extract features (edges, shapes, patterns)
- Identify body parts (head, shoulders, arms, etc.)
- Predict keypoint locations

### 3. **Output: 33 Landmarks**
Each landmark has:
- **x, y**: Normalized coordinates (0.0 to 1.0)
- **z**: Depth (relative, not absolute)
- **visibility**: Confidence score (0.0 to 1.0)

## Simple Example

Let's say we have a person standing in the center of a 640x480 image:

### Step 1: Image Input
```
Image: 640x480 pixels
Person is at center: roughly (320, 240) in pixel coordinates
```

### Step 2: Model Processing
The CNN processes the image and outputs normalized coordinates:

```
Landmark 0 (Nose):
  x = 0.5  (50% from left = 320 pixels)
  y = 0.2  (20% from top = 96 pixels)
  z = 0.0  (no depth info)
  visibility = 0.95 (95% confident)

Landmark 11 (Left Shoulder):
  x = 0.45 (45% from left = 288 pixels)
  y = 0.4  (40% from top = 192 pixels)
  z = -0.1 (slightly behind)
  visibility = 0.92

Landmark 12 (Right Shoulder):
  x = 0.55 (55% from left = 352 pixels)
  y = 0.4  (40% from top = 192 pixels)
  z = -0.1
  visibility = 0.92
```

### Step 3: Converting Back to Pixel Coordinates

To draw on the canvas, we convert normalized coordinates to pixels:

```javascript
// Canvas is 640x480
const pixelX = landmark.x * canvasWidth;
const pixelY = landmark.y * canvasHeight;

// Example for nose:
pixelX = 0.5 * 640 = 320 pixels
pixelY = 0.2 * 480 = 96 pixels
```

## The Neural Network Math (Simplified)

### Forward Pass (Detection)

1. **Convolution Layers**: Extract features
   ```
   Feature = Convolution(Image, Kernel) + Bias
   ```
   - Scans image with filters to find patterns
   - Detects edges, shapes, body parts

2. **Pooling Layers**: Reduce size
   ```
   Pooled = MaxPool(Features)
   ```
   - Downsamples to focus on important features

3. **Fully Connected Layers**: Make predictions
   ```
   Prediction = Activation(Weights × Features + Bias)
   ```
   - Combines features to predict keypoint locations

### Loss Function (During Training)

The model was trained to minimize:
```
Loss = Σ (Predicted_Keypoint - Actual_Keypoint)²
```

## Real Example: Detecting a Shoulder

Let's trace through detecting the left shoulder:

1. **Input**: Image with person
2. **Feature Extraction**: CNN finds "shoulder-like" patterns
   - Detects circular/rounded shapes at shoulder height
   - Identifies connection to neck and arm
3. **Prediction**: Model outputs:
   ```
   x = 0.45, y = 0.4, visibility = 0.92
   ```
4. **Conversion**: 
   ```javascript
   // For 640x480 canvas:
   shoulderX = 0.45 * 640 = 288 pixels
   shoulderY = 0.4 * 480 = 192 pixels
   ```
5. **Drawing**: Place red dot at (288, 192)

## How We Use It in Dance Battle

### 1. **Detection**
```javascript
// MediaPipe processes the image
const results = await poseDetector.detectPose(video);

// Results contain 33 landmarks
results.poseLandmarks[11] // Left shoulder
// { x: 0.45, y: 0.4, z: -0.1, visibility: 0.92 }
```

### 2. **Comparison**
```javascript
// Calculate distance between user and reference
const dx = userLandmark.x - referenceLandmark.x;
const dy = userLandmark.y - referenceLandmark.y;
const distance = Math.sqrt(dx² + dy²);

// Convert to similarity score
const similarity = 1 - (distance / threshold);
```

### 3. **Movement Detection**
```javascript
// Compare consecutive frames
const movement = Math.sqrt(
  (pose2.x - pose1.x)² + (pose2.y - pose1.y)²
);

// If movement > threshold, person is moving
if (movement > 0.02) {
  // Award points
}
```

## Key Concepts

1. **Normalized Coordinates**: Always 0.0 to 1.0, regardless of image size
   - Makes it resolution-independent
   - Easy to scale to any canvas size

2. **Visibility Score**: Confidence that the keypoint is actually visible
   - 1.0 = definitely there
   - 0.5 = maybe there
   - 0.0 = not detected

3. **Z-Depth**: Relative depth (not absolute)
   - Negative = closer to camera
   - Positive = farther from camera
   - 0 = at reference plane

## Why This Works Well

- **Fast**: Optimized for real-time (30-60 FPS)
- **Accurate**: Trained on millions of images
- **Robust**: Works in various lighting/backgrounds
- **Lightweight**: Runs in browser without GPU

## Limitations

- Works best with full body visible
- Struggles with occlusions (body parts hidden)
- Requires reasonable lighting
- Single person focus (though can detect multiple)

