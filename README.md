# Dance Battle App

A React-based dance battle application that uses pose detection to compare your movements with a reference dance video.

## Features

- Real-time pose detection using MediaPipe
- Movement comparison and scoring
- PostgreSQL database for storing analyzed pose data
- Visual feedback for good matches
- Railway deployment ready

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your DATABASE_URL
```

3. Run development server:
```bash
npm run dev
```

4. Run backend server (in another terminal):
```bash
npm run server
```

## Database Setup

The app uses PostgreSQL to store analyzed pose data. On first load, if pose data doesn't exist in the database, it will automatically analyze the reference video and save it.

Make sure your `DATABASE_URL` is set in your `.env` file or Railway environment variables.

## Deployment on Railway

1. Connect your GitHub repository to Railway
2. Add a PostgreSQL service
3. Set the `DATABASE_URL` environment variable
4. Deploy!

The app will automatically:
- Check for existing pose data on first load
- Analyze and save pose data if not found
- Use saved data on subsequent loads

## Project Structure

- `src/` - React application source code
- `server/` - Express backend with PostgreSQL integration
- `public/` - Static assets (videos, etc.)

