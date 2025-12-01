import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

// Initialize PostgreSQL if DATABASE_URL is set
let postgresPool = null;
if (process.env.DATABASE_URL) {
  import('./src/utils/postgresStorage.js').then(async ({ initPostgres }) => {
    try {
      postgresPool = await initPostgres(process.env.DATABASE_URL);
      console.log('✅ PostgreSQL initialized');
    } catch (error) {
      console.warn('⚠️  PostgreSQL initialization failed, using file storage:', error.message);
    }
  });
}

// API endpoint to load poses (supports both PostgreSQL and files)
app.get('/api/poses/:key', async (req, res) => {
  const key = req.params.key;
  
  // Try PostgreSQL first if available
  if (postgresPool) {
    try {
      const { loadPosesFromPostgres } = await import('./src/utils/postgresStorage.js');
      const poses = await loadPosesFromPostgres(key);
      if (poses && poses.length > 0) {
        return res.json(poses);
      }
    } catch (error) {
      console.warn('PostgreSQL load failed, trying files:', error.message);
    }
  }
  
  // Fallback to files
  try {
    const fileName = key.replace('danceBattle_', '') + '.json';
    const filePath = join(__dirname, 'public', 'poses', fileName);
    if (existsSync(filePath)) {
      const poses = JSON.parse(readFileSync(filePath, 'utf8'));
      if (Array.isArray(poses) && poses.length > 0) {
        return res.json(poses);
      }
    }
  } catch (error) {
    console.error('Error loading from file:', error.message);
  }
  
  res.status(404).json({ error: 'Poses not found', key });
});

// Serve static files from dist directory
app.use(express.static(join(__dirname, 'dist')));

// Serve public files (videos, poses, etc.)
app.use(express.static(join(__dirname, 'public')));

// Explicitly serve poses folder
app.use('/poses', express.static(join(__dirname, 'public', 'poses')));

// Handle client-side routing - serve index.html for all routes
app.get('*', (req, res) => {
  try {
    const indexPath = join(__dirname, 'dist', 'index.html');
    const indexHtml = readFileSync(indexPath, 'utf8');
    res.send(indexHtml);
  } catch (error) {
    console.error('Error serving index.html:', error);
    res.status(500).send(`
      <html>
        <body>
          <h1>Application Error</h1>
          <p>The application failed to load. Please ensure the build completed successfully.</p>
          <p>Error: ${error.message}</p>
        </body>
      </html>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Serving files from dist/ and public/`);
  if (postgresPool) {
    console.log(`🗄️  PostgreSQL enabled`);
  } else {
    console.log(`📁 Using file storage (public/poses/)`);
  }
});
