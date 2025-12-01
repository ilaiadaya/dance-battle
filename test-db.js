#!/usr/bin/env node
/**
 * Quick test script to check database connection and data
 */

import pg from 'pg';
const { Pool } = pg;
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load DATABASE_URL from .env
let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  try {
    const envPath = join(__dirname, '.env');
    const envContent = readFileSync(envPath, 'utf8');
    const match = envContent.match(/DATABASE_URL=(.+)/);
    if (match) {
      databaseUrl = match[1].trim();
    }
  } catch (error) {
    console.error('❌ No DATABASE_URL found in .env');
    process.exit(1);
  }
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('railway') || databaseUrl.includes('sslmode=require') 
    ? { rejectUnauthorized: false } 
    : false
});

async function testDatabase() {
  try {
    console.log('🔍 Testing database connection...\n');
    
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Database connected!\n');
    
    // Check for pose data
    const result = await pool.query(`
      SELECT 
        key, 
        LENGTH(data::text) as size,
        created_at
      FROM poses 
      ORDER BY created_at DESC
    `);
    
    if (result.rows.length === 0) {
      console.log('⚠️  No pose data found in database');
      console.log('   Run: npm run process-frames (saves to database if DATABASE_URL is set)\n');
    } else {
      console.log(`✅ Found ${result.rows.length} pose entries:\n`);
      result.rows.forEach(row => {
        const sizeKB = Math.round(row.size / 1024);
        const sizeMB = (sizeKB / 1024).toFixed(2);
        console.log(`   - ${row.key}: ${sizeMB}MB (${new Date(row.created_at).toLocaleString()})`);
      });
      console.log('\n✅ Database is ready! The app will load from here.\n');
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Database error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

testDatabase();

