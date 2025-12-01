# Railway Deployment Fix

## Issue: "Connected branch does not exist"

This usually happens when:
1. The GitHub repository doesn't have a `main` branch yet
2. Railway is trying to connect to a branch that hasn't been pushed
3. There's a mismatch between local and remote branch names

## Solution

### Step 1: Verify your branch exists on GitHub

1. Go to: https://github.com/ilaiadaya/dance-battle
2. Check if you see a `main` branch
3. If not, the repository might be empty

### Step 2: Push your code to GitHub

If you haven't pushed yet:
```bash
git push -u origin main
```

### Step 3: In Railway

1. **Disconnect the current connection** (if any)
2. **Create a new project** or **reconnect**:
   - Go to Railway dashboard
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `ilaiadaya/dance-battle`
   - Select the `main` branch
   - Railway will automatically detect the project

### Step 4: Configure Railway

Railway should automatically:
- Detect it's a Node.js project
- Use `railway.json` for build/start commands
- Set up environment variables

### Alternative: Manual Deploy

If automatic deploy doesn't work:

1. **In Railway dashboard:**
   - Go to your project
   - Settings → Source
   - Make sure branch is set to `main`
   - Click "Redeploy"

2. **Or use Railway CLI:**
   ```bash
   npm install -g @railway/cli
   railway login
   railway link
   railway up
   ```

## Common Issues

### "Branch does not exist"
- Make sure you've pushed to GitHub: `git push origin main`
- Check branch name matches (main vs master)
- Verify repository name: `ilaiadaya/dance-battle`

### "Deploy from source error"
- Check Railway logs for specific error
- Verify `package.json` has correct scripts
- Make sure `railway.json` exists and is valid
- Check that all dependencies are in `package.json`

### Large files (Git LFS)
- Video files are tracked with Git LFS
- Make sure Git LFS is installed: `git lfs install`
- Large files might take time to upload

## Verification

After deployment:
1. Check Railway logs for build success
2. Visit the generated Railway URL
3. Verify the app loads correctly

