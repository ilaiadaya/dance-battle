import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

// Serve static files from dist directory
app.use(express.static(join(__dirname, 'dist')));

// Serve public files (videos, poses, etc.)
app.use(express.static(join(__dirname, 'public')));

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
});

