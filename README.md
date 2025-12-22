# Dance Battle App

A real-time dance battle app that analyzes your movements against reference dance videos using pose detection.

## Setup

### Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Database Connection

Create a `.env` file in the root directory with your PostgreSQL connection string:

```env
DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-noisy-recipe-a4cxmlpx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
PORT=3000
```

Replace `YOUR_PASSWORD` with your actual database password.

### 3. Import Existing Pose Data (Optional)

If you have existing JSON files with pose data, import them to the database:

```bash
node import-poses-pg.js
```

This will import `danceone.json` and `dancetwo.json` into the PostgreSQL database.

### 4. Start the Server

```bash
npm start
```

The server will run on `http://localhost:3000`

### 5. Access the App

Open your browser and navigate to:
```
http://localhost:3000/index.html
```

## Features

- Real-time pose detection using MediaPipe
- Movement comparison and scoring
- Support for multiple dance videos
- Pose data stored in PostgreSQL database
- Visual feedback for good matches
- Mirrored camera view

## API Endpoints

- `GET /api/poses/:danceName` - Get poses for a specific dance
- `POST /api/poses/:danceName` - Save poses for a specific dance
- `GET /api/dances` - List all available dances
- `GET /api/poses/:danceName/exists` - Check if poses exist for a dance

## Railway Deployment

### 1. Connect to Railway
- Push your code to GitHub
- Connect your GitHub repo to Railway
- Railway will automatically detect the Node.js app

### 2. Set Environment Variables
In Railway dashboard, add these environment variables:
- `DATABASE_URL` - Your PostgreSQL connection string
- `PORT` - Railway will set this automatically (optional to set manually)
- `NODE_ENV` - Set to `production` (optional)

### 3. Deploy
Railway will automatically:
- Install dependencies from `package.json`
- Run `node server.js` (from Procfile)
- Serve your app on Railway's domain

### 4. Database Setup
Make sure your PostgreSQL database is accessible from Railway. You can:
- Use Railway's PostgreSQL service
- Use an external database (like Neon) - ensure it allows connections from Railway's IPs

## Database Schema

```sql
CREATE TABLE poses (
    id SERIAL PRIMARY KEY,
    dance_name VARCHAR(255) UNIQUE NOT NULL,
    pose_data JSONB NOT NULL,
    frame_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

