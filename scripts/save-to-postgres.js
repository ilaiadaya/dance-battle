#!/usr/bin/env node

/**
 * Save pose data from files to PostgreSQL
 * 
 * Usage: DATABASE_URL=your_postgres_url node scripts/save-to-postgres.js
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const posesDir = join(projectRoot, 'public', 'poses');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL environment variable not set');
  process.exit(1);
}

async function saveToPostgres() {
  const pool = new Pool({
    connectionString: connectionString,
    ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });

  try {
    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS poses (
        key VARCHAR(255) PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Read all JSON files from poses directory
    if (!existsSync(posesDir)) {
      console.error(`❌ Poses directory not found: ${posesDir}`);
      process.exit(1);
    }

    const files = readdirSync(posesDir).filter(f => f.endsWith('.json'));
    
    if (files.length === 0) {
      console.log('⚠️  No JSON files found in public/poses/');
      console.log('   Run: npm run preprocess-files first\n');
      process.exit(0);
    }

    console.log(`📦 Found ${files.length} pose file(s) to upload...\n`);

    for (const file of files) {
      const filePath = join(posesDir, file);
      const fileName = file.replace('.json', '');
      const key = `danceBattle_${fileName}`;
      
      try {
        const data = JSON.parse(readFileSync(filePath, 'utf8'));
        
        if (!Array.isArray(data)) {
          console.log(`⚠️  Skipping ${file}: Not a valid pose array`);
          continue;
        }

        await pool.query(
          `INSERT INTO poses (key, data, updated_at) 
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (key) 
           DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP`,
          [key, JSON.stringify(data)]
        );
        
        console.log(`✅ Saved ${data.length} poses from ${file} → PostgreSQL (key: ${key})`);
      } catch (error) {
        console.error(`❌ Error processing ${file}:`, error.message);
      }
    }

    console.log('\n✅ Done! All pose data saved to PostgreSQL.\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

saveToPostgres();

