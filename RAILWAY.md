# Railway Deployment Guide

This app is ready to deploy on Railway!

## Quick Deploy

1. **Connect your GitHub repository to Railway:**
   - Go to [Railway](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `dance-battle` repository

2. **Railway will automatically:**
   - Detect it's a Node.js project
   - Run `npm install`
   - Run `npm run build` (from railway.json)
   - Start the server with `npm start`

3. **That's it!** Your app will be live.

## Configuration

The app is configured with:
- **Build Command:** `npm run build` (builds React app)
- **Start Command:** `npm start` (starts Express server)
- **Port:** Automatically uses Railway's `PORT` environment variable

## Important Notes

### Video Files
- Video files (`danceone.mp4`, `dancetwo.mp4`) are in `public/` and will be served
- These files are large - make sure they're committed to git or Railway may have size limits
- Consider using external storage (S3, Cloudflare R2) for large videos in production

### Pose Data Files
- Pose data files in `public/poses/` will be served
- If these are large, consider:
  - Using Git LFS
  - Storing in external storage
  - Or generating them on first run

### Environment Variables
- `PORT` - Railway sets this automatically
- `NODE_ENV=production` - Railway sets this automatically
- `DATABASE_URL` - Railway automatically provides this if you add a PostgreSQL service

### Preprocessing on Railway

After deploying, you can run preprocessing directly on Railway:

1. **Add PostgreSQL service** in Railway (if not already added)
2. **Railway automatically sets `DATABASE_URL`** environment variable
3. **Run preprocessing:**
   - Go to your service → Deployments → Run Command
   - Or use Railway CLI: `railway run npm run preprocess-db`
   
   This will process videos and save directly to your Railway PostgreSQL database.

**Note:** Railway internal database URLs work perfectly on Railway, so preprocessing will work automatically!

## Custom Domain

After deployment:
1. Go to your project settings in Railway
2. Click "Generate Domain" or add a custom domain
3. Your app will be accessible at that URL

## Troubleshooting

**Build fails:**
- Check Railway logs
- Ensure all dependencies are in `package.json`
- Make sure `node_modules/` is in `.gitignore`

**App doesn't load:**
- Check that `dist/` folder is being built
- Verify `server.js` is starting correctly
- Check Railway logs for errors

**Videos not loading:**
- Ensure video files are in `public/` directory
- Check file sizes (Railway has limits)
- Verify public folder is being served

## Production Considerations

1. **Large Files:** Consider using CDN for videos
2. **Pose Data:** Pre-generate and commit, or generate on first request
3. **Caching:** Add cache headers for static assets
4. **HTTPS:** Railway provides HTTPS automatically

## Monitoring

Railway provides:
- Real-time logs
- Metrics dashboard
- Automatic deployments on git push

