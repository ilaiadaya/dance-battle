# Where Are Analyzed Poses Saved?

## Browser Storage (Current Implementation)

The analyzed poses are saved **locally in your browser** using:

1. **IndexedDB** (preferred) - Database stored in your browser
   - Database name: `DanceBattleDB`
   - Store name: `poses`
   - Keys: `danceBattle_danceone`, `danceBattle_dancetwo`, etc.
   - Location (browser-specific):
     - **Chrome/Edge**: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\IndexedDB\` (Windows) or `~/Library/Application Support/Google/Chrome/Default/IndexedDB/` (Mac)
     - **Firefox**: `~/Library/Application Support/Firefox/Profiles/[profile]/storage/default/` (Mac)
     - **Safari**: `~/Library/Safari/LocalStorage/` (Mac)

2. **localStorage** (fallback) - Simple key-value storage
   - Keys: `danceBattle_danceone`, `danceBattle_dancetwo`, etc.
   - Location: Browser's localStorage (not directly accessible as files)

## Exporting to Files

You can now export the pose data as JSON files:

### Method 1: Automatic Export
- When you analyze a video using the "Analyze Video" tool, it automatically downloads a JSON file
- The file is saved to your Downloads folder with the name: `danceBattle_[videoname].json`

### Method 2: Manual Export
- Click the **"Export Data"** button in the main app
- This exports ALL saved pose data as a single JSON file
- File name: `dance-battle-poses-export-[timestamp].json`

## File Format

The exported JSON files contain:
```json
{
  "exportedAt": "2024-01-01T12:00:00.000Z",
  "poses": {
    "danceBattle_danceone": [
      [/* array of pose landmarks */],
      [/* ... */]
    ],
    "danceBattle_dancetwo": [
      [/* ... */]
    ]
  }
}
```

Or for single video exports:
```json
[
  [/* pose landmarks frame 1 */],
  [/* pose landmarks frame 2 */],
  [/* ... */]
]
```

## Importing Back

To import previously exported JSON files:
1. Use the "Analyze Video" tool
2. Select a JSON file (it will detect and import it)
3. Or manually load the data using browser DevTools

## Notes

- **Browser-specific**: Data is stored per browser and per domain
- **Not shared**: Data from one browser doesn't appear in another
- **Persistent**: Data persists even after closing the browser
- **Can be cleared**: Clearing browser data will delete the poses
- **Export recommended**: Always export important pose data as JSON files for backup

## Finding Your Data

To see what's stored:
1. Open browser DevTools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Expand **IndexedDB** → **DanceBattleDB** → **poses**
4. You'll see all saved pose data with keys and timestamps

