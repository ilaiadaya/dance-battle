# 🎵 Dance Battle App

A React-based dance battle application that uses MediaPipe Pose detection to compare your movements with reference dance videos in real-time.

## Features

- 🎯 Real-time pose detection using MediaPipe
- 🎬 Support for multiple reference videos
- 💾 Automatic pose data caching (IndexedDB/localStorage)
- 🎨 Visual feedback when matching moves (green flash)
- 📊 Scoring system with win condition
- 🔄 Video analysis tool for preprocessing

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Preprocess videos (required for first run):**
   
   **Option A - Direct to files (recommended):**
   ```bash
   npm run preprocess-files
   ```
   This will:
   - Process videos in a headless browser
   - Save pose data directly to `public/poses/` folder as JSON files
   - No browser interaction needed - pure terminal script
   
   **Option B - Browser-based (alternative):**
   ```bash
   npm run preprocess
   ```
   Then run `npm run extract-poses` to save to files.

4. **Run the app:**
   ```bash
   npm run dev
   ```
   The app will open at `http://localhost:8000`

## Usage

1. **Select a reference video** from the dropdown (danceone or dancetwo)
2. Click **"Start Battle"** - the app will:
   - Request camera permission
   - Load saved pose data (or prompt you to analyze if not found)
   - Start comparing your movements in real-time
3. **Follow the dance moves** shown in the reference video
4. **Earn points** by matching the movements - reach 1000 points to win!

## Video Analysis Tool

Click **"Analyze Video"** to:
- Upload and analyze any video file
- Save pose data for later use
- Process videos that aren't preprocessed

## Project Structure

```
dance/
├── src/
│   ├── components/
│   │   ├── DanceBattle.jsx    # Main dance battle component
│   │   └── VideoAnalyzer.jsx   # Video analysis tool
│   ├── utils/
│   │   ├── poseDetector.js     # MediaPipe pose detection
│   │   ├── movementComparer.js # Movement comparison logic
│   │   └── storage.js          # IndexedDB/localStorage utilities
│   ├── App.jsx                 # Main app component
│   ├── App.css                 # Styles
│   └── main.jsx                # Entry point
├── public/
│   ├── danceone.mp4           # Reference video 1
│   ├── dancetwo.mp4           # Reference video 2
│   ├── poses/                 # Pose data files (auto-loaded)
│   │   ├── danceone.json      # Preprocessed poses for danceone
│   │   └── dancetwo.json      # Preprocessed poses for dancetwo
│   └── preprocess.html         # Preprocessing page
├── package.json
└── vite.config.js
```

## Build for Production

```bash
npm run build
npm start
```

The built files will be in the `dist/` directory.

## Deploy to Railway

This app is ready to deploy on Railway! See [RAILWAY.md](RAILWAY.md) for detailed instructions.

**Quick deploy:**
1. Push your code to GitHub
2. Connect your repo to Railway
3. Railway will automatically build and deploy

The app includes:
- ✅ Production server (`server.js`)
- ✅ Railway configuration (`railway.json`)
- ✅ Proper build and start scripts

## Technologies

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **MediaPipe Pose** - Pose detection
- **IndexedDB** - Large data storage
- **localStorage** - Fallback storage

## Notes

- The app requires camera access
- Videos must be in the `public/` directory
- Pose data is saved to browser storage (IndexedDB preferred, localStorage fallback)
- The preprocessing step is recommended for better performance

## Debugging

### Browser Console
- **Chrome/Edge (Windows/Linux):** Press `F12` or `Ctrl + Shift + I`
- **Chrome/Edge (Mac):** Press `Cmd + Option + I`
- **Firefox:** Press `F12` or `Ctrl + Shift + K` (Mac: `Cmd + Option + K`)

See `CONSOLE.md` for detailed console access instructions.

### Common Issues

**"Analyze Video" button not working:**
- Open browser console (F12) and check for errors
- Make sure MediaPipe scripts are loaded (check Network tab)
- Try refreshing the page

**Videos not preprocessing:**
- Make sure videos are in `public/` directory
- Check browser console for errors
- Ensure dev server is running on port 8000

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- [MediaPipe](https://mediapipe.dev/) for pose detection
- [React](https://react.dev/) for the UI framework
- [Vite](https://vitejs.dev/) for the build tool

