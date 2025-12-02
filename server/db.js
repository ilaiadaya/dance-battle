import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }
  return pool;
}

export async function createClient() {
  const pool = getPool();
  
  // Create table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pose_data (
      id SERIAL PRIMARY KEY,
      video_name VARCHAR(255) UNIQUE NOT NULL,
      poses JSONB NOT NULL,
      frame_count INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create index on video_name for faster lookups
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_video_name ON pose_data(video_name)
  `);
  
  return pool;
}

