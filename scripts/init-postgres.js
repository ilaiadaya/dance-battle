#!/usr/bin/env node

/**
 * Initialize PostgreSQL database for pose storage
 * 
 * Usage: DATABASE_URL=your_postgres_url node scripts/init-postgres.js
 */

import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL environment variable not set');
  console.log('\nUsage:');
  console.log('  DATABASE_URL=postgresql://user:pass@host:port/dbname node scripts/init-postgres.js\n');
  process.exit(1);
}

async function initDatabase() {
  const pool = new Pool({
    connectionString: connectionString,
    ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });

  try {
    // Create table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS poses (
        key VARCHAR(255) PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ PostgreSQL database initialized successfully!');
    console.log('✅ Table "poses" created/verified\n');
    
    // Check if there's existing data
    const result = await pool.query('SELECT COUNT(*) FROM poses');
    console.log(`📊 Current pose entries: ${result.rows[0].count}\n`);
    
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();

