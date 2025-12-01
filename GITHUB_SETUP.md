# GitHub Repository Setup

Your project is now ready to be pushed to GitHub!

## Steps to Create GitHub Repository

1. **Create a new repository on GitHub:**
   - Go to https://github.com/new
   - Repository name: `dance-battle` (or your preferred name)
   - Description: "Dance Battle App with React and MediaPipe Pose Detection"
   - Choose Public or Private
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
   - Click "Create repository"

2. **Update the repository URL in package.json:**
   ```bash
   # Edit package.json and replace YOUR_USERNAME with your GitHub username
   ```

3. **Add the remote and push:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/dance-battle.git
   git branch -M main
   git push -u origin main
   ```

## What's Included

✅ Git repository initialized
✅ .gitignore configured
✅ README.md with full documentation
✅ LICENSE file (MIT)
✅ GitHub Actions CI workflow
✅ All source code and scripts

## Files Excluded from Git

- `node_modules/` - Dependencies (install with `npm install`)
- `dist/` - Build output
- `public/poses/*.json` - Pose data files (optional, currently included)
- `.DS_Store` - macOS system files
- Log files

## Note

The pose data files in `public/poses/` are currently included in git. If they're large, you may want to:
1. Add them to .gitignore
2. Use Git LFS for large files
3. Or document that users need to run preprocessing

## Next Steps

After pushing to GitHub:
- Add topics/tags: `dance`, `pose-detection`, `mediapipe`, `react`, `computer-vision`
- Add a description
- Consider adding screenshots/GIFs to the README
- Set up GitHub Pages if you want to host it

