# How to Access Browser Console

The browser console is where you can see errors, logs, and debug information.

## Opening the Console

### Chrome/Edge (Windows/Linux):
- Press `F12` or `Ctrl + Shift + I`
- Or: Right-click page → "Inspect" → Click "Console" tab

### Chrome/Edge (Mac):
- Press `Cmd + Option + I`
- Or: Right-click page → "Inspect" → Click "Console" tab

### Firefox (Windows/Linux):
- Press `F12` or `Ctrl + Shift + K`

### Firefox (Mac):
- Press `Cmd + Option + K`

### Safari (Mac):
- First enable Developer menu: Safari → Preferences → Advanced → Check "Show Develop menu"
- Then: `Cmd + Option + C`

## What to Look For

When debugging the "Analyze Video" button:

1. **Errors** (red text) - These indicate what's broken
2. **Warnings** (yellow text) - These indicate potential issues
3. **Logs** (gray/white text) - These show what the app is doing

## Common Issues

### "Analyze Video" button not working:
- Check console for errors
- Look for messages like "Pose is not defined" or "MediaPipe not loaded"
- Make sure MediaPipe scripts loaded (check Network tab)

### Video not analyzing:
- Check if file was selected
- Look for errors about video loading
- Check if pose detection is initializing

## Quick Debug Steps

1. Open console (F12)
2. Click "Analyze Video" button
3. Look for any red errors
4. Try selecting a video file
5. Click "Analyze & Save"
6. Watch console for progress messages

## Terminal Console

For server logs and preprocessing:
- The terminal where you ran `npm run dev` shows server logs
- The preprocessing script (`npm run preprocess`) shows progress in terminal

