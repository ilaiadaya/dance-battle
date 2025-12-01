#!/usr/bin/env node

/**
 * Quick script to load pose data to PostgreSQL
 * Reads from .env file automatically
 * 
 * Usage: node scripts/load-to-postgres.js
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Load .env file
const envPath = join(projectRoot, '.env');
let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf8');
  const match = envContent.match(/DATABASE_URL=(.+)/);
  if (match) {
    databaseUrl = match[1].trim();
  }
}

if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL not found in .env file or environment');
  process.exit(1);
}

// Check if it's a Railway internal URL (won't work locally)
if (databaseUrl.includes('railway.internal')) {
  console.error('❌ Error: Railway internal URLs only work inside Railway.');
  console.error('   For local use, you need the public connection URL from Railway dashboard.');
  console.error('   Go to Railway → Your Database → Connect → Copy the public URL\n');
  process.exit(1);
}

console.log('🗄️  Loading pose data to PostgreSQL...\n');
console.log('📋 This will:');
console.log('   1. Extract pose data from browser IndexedDB');
console.log('   2. Save directly to PostgreSQL database\n');

// Import and run the extract script
import('./extract-to-postgres.js').catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

