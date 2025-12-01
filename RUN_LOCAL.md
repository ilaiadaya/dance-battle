# Run Locally with Database

## Quick Start

1. **Test database connection:**
   ```bash
   node test-db.js
   ```
   Should show: `✅ Found 2 pose entries`

2. **Build the app:**
   ```bash
   npm run build
   ```

3. **Start the server:**
   ```bash
   npm start
   ```
   
   You should see:
   ```
   🚀 Server running on port 8000
   📦 Serving files from dist/ and public/
   🗄️  PostgreSQL enabled
   ```

4. **Open in browser:**
   - Go to: http://localhost:8000
   - Open browser console (F12)
   - Look for: `✅ Loaded X poses from server`

## Verify Database Loading

**In browser console, you should see:**
```
✅ Loaded 2689 poses from server (danceBattle_dancetwo)
```

**If you see "from file" instead:**
- Check server logs - should say "PostgreSQL enabled"
- Check `.env` has `DATABASE_URL` set
- Restart the server

## Test API Directly

```bash
# Test the API endpoint
curl http://localhost:8000/api/poses/danceBattle_dancetwo | head -c 200

# Should return JSON array starting with: [{"x":0.5...
```

## Troubleshooting

**Port 8000 already in use:**
```bash
pkill -f "node server.js"
# Or change PORT in .env
```

**Database not connecting:**
- Check `.env` file has correct `DATABASE_URL`
- Test with: `node test-db.js`
- Railway internal URLs won't work locally - use public connection URL

**Poses not loading:**
- Check server logs for errors
- Verify data in database: `node test-db.js`
- Check browser console for error messages

