/**
 * PostgreSQL storage for pose data
 * Use this if you have a Postgres database URL
 */

let pool = null;

export async function initPostgres(connectionString) {
  if (pool) return pool;
  
  try {
    const { default: pg } = await import('pg');
    pool = new pg.Pool({
      connectionString: connectionString,
      ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false
    });
    
    // Create table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS poses (
        key VARCHAR(255) PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Connected to PostgreSQL');
    return pool;
  } catch (error) {
    console.error('❌ PostgreSQL connection error:', error);
    throw error;
  }
}

export async function savePosesToPostgres(key, poses) {
  if (!pool) {
    throw new Error('PostgreSQL not initialized. Call initPostgres first.');
  }
  
  try {
    await pool.query(
      `INSERT INTO poses (key, data, updated_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key) 
       DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP`,
      [key, JSON.stringify(poses)]
    );
    console.log(`✅ Saved ${poses.length} poses to PostgreSQL (key: ${key})`);
  } catch (error) {
    console.error('Error saving to PostgreSQL:', error);
    throw error;
  }
}

export async function loadPosesFromPostgres(key) {
  if (!pool) {
    return null;
  }
  
  try {
    const result = await pool.query(
      'SELECT data FROM poses WHERE key = $1',
      [key]
    );
    
    if (result.rows.length > 0) {
      const data = result.rows[0].data;
      // Handle both JSONB (object) and string formats
      const poses = typeof data === 'string' ? JSON.parse(data) : data;
      console.log(`✅ Loaded ${Array.isArray(poses) ? poses.length : 'unknown'} poses from PostgreSQL (key: ${key})`);
      return Array.isArray(poses) ? poses : null;
    }
    return null;
  } catch (error) {
    console.error('Error loading from PostgreSQL:', error);
    return null;
  }
}

// Export pool for server use
export function getPool() {
  return pool;
}

