require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '100mb' })); // Large limit for pose data
app.use(express.static('.')); // Serve static files from root
app.use('/public', express.static('public')); // Also serve from public directory

// Initialize PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:xxxx@ep-noisy-recipe-a4cxmlpx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ssl: {
        rejectUnauthorized: false
    }
});

// Test connection and create table
pool.query(`
    CREATE TABLE IF NOT EXISTS poses (
        id SERIAL PRIMARY KEY,
        dance_name VARCHAR(255) UNIQUE NOT NULL,
        pose_data JSONB NOT NULL,
        frame_count INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`, (err) => {
    if (err) {
        console.error('Error creating table:', err);
    } else {
        console.log('✅ Database table ready');
    }
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection error:', err);
    } else {
        console.log('✅ Connected to PostgreSQL database');
        console.log('   Current time:', res.rows[0].now);
    }
});

// Get pose data for a specific dance
app.get('/api/poses/:danceName', async (req, res) => {
    const danceName = req.params.danceName;
    
    try {
        // Test connection first
        await pool.query('SELECT 1');
        
        const result = await pool.query(
            'SELECT pose_data, frame_count FROM poses WHERE dance_name = $1',
            [danceName]
        );
        
        if (result.rows.length > 0) {
            const row = result.rows[0];
            // Parse JSONB if it's a string, otherwise use directly
            let poses = row.pose_data;
            if (typeof poses === 'string') {
                try {
                    poses = JSON.parse(poses);
                } catch (parseError) {
                    console.error('Error parsing pose_data:', parseError);
                    return res.status(500).json({ 
                        error: 'Error parsing pose data',
                        message: parseError.message 
                    });
                }
            }
            
            res.json({
                success: true,
                poses: poses,
                frameCount: row.frame_count,
                danceName: danceName
            });
        } else {
            res.json({
                success: false,
                message: 'No pose data found for ' + danceName
            });
        }
    } catch (error) {
        console.error('Database error in GET /api/poses:', error.message);
        console.error('Error code:', error.code);
        console.error('Error detail:', error.detail);
        res.status(500).json({ 
            error: 'Database error',
            message: error.message,
            code: error.code
        });
    }
});

// Save pose data for a specific dance
app.post('/api/poses/:danceName', async (req, res) => {
    const danceName = req.params.danceName;
    const { poses } = req.body;
    
    if (!poses || !Array.isArray(poses)) {
        return res.status(400).json({ error: 'Invalid pose data' });
    }
    
    const frameCount = poses.length;
    
    try {
        // Test connection first
        await pool.query('SELECT 1');
        
        // Use INSERT ... ON CONFLICT for PostgreSQL
        const result = await pool.query(
            `INSERT INTO poses (dance_name, pose_data, frame_count, updated_at) 
             VALUES ($1, $2::jsonb, $3, CURRENT_TIMESTAMP)
             ON CONFLICT (dance_name) 
             DO UPDATE SET pose_data = $2::jsonb, frame_count = $3, updated_at = CURRENT_TIMESTAMP
             RETURNING frame_count`,
            [danceName, JSON.stringify(poses), frameCount]
        );
        
        res.json({
            success: true,
            message: `Saved ${frameCount} poses for ${danceName}`,
            frameCount: frameCount
        });
    } catch (error) {
        console.error('Database error in POST /api/poses:', error.message);
        console.error('Error code:', error.code);
        console.error('Error detail:', error.detail);
        res.status(500).json({ 
            error: 'Failed to save pose data',
            message: error.message,
            code: error.code
        });
    }
});

// List all available dances
app.get('/api/dances', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT dance_name, frame_count, created_at, updated_at FROM poses ORDER BY dance_name'
        );
        
        res.json({
            success: true,
            dances: result.rows
        });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Check if pose data exists for a dance
app.get('/api/poses/:danceName/exists', async (req, res) => {
    const danceName = req.params.danceName;
    
    try {
        const result = await pool.query(
            'SELECT COUNT(*) as count FROM poses WHERE dance_name = $1',
            [danceName]
        );
        
        res.json({
            exists: parseInt(result.rows[0].count) > 0
        });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
        console.log(`📱 Access the app at http://localhost:${PORT}/index.html`);
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await pool.end();
    console.log('✅ Database connection closed');
    process.exit(0);
});
