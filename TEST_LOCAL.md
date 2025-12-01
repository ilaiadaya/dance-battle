# Testing Database Connection Locally

## Quick Test

1. **Make sure you have pose data in the database:**
   ```bash
   # If DATABASE_URL is in .env, this will save to both files and database
   npm run process-frames
   ```

2. **Start the server:**
   ```bash
   npm run build  # Build the React app first
   npm start      # Start the Express server
   ```

3. **Open the app:**
   - Go to: http://localhost:8000
   - Open browser console (F12)
   - Look for: `✅ Loaded X poses from server`

## Check Database Connection

The server will show in the console:
- `✅ PostgreSQL initialized` - if DATABASE_URL is set and connection works
- `📁 Using file storage` - if no DATABASE_URL or connection failed

## Test API Endpoint Directly

```bash
# Test if poses load from database
curl http://localhost:8000/api/poses/danceBattle_dancetwo

# Should return JSON array of poses if working
```

## Troubleshooting

**If you see "Using file storage":**
- Check `.env` file has `DATABASE_URL=...`
- Make sure the database is accessible from your local machine
- Railway internal URLs won't work locally - use the public connection URL

**If poses don't load:**
- Check server logs for errors
- Verify data is in database: `npm run save-to-postgres` (if you have files)
- Or run: `npm run process-frames` to generate and save

