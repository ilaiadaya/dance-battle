require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Initialize PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:xxxx@ep-noisy-recipe-a4cxmlpx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ssl: {
        rejectUnauthorized: false
    }
});

// Create table if it doesn't exist
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
        process.exit(1);
    }
    
    console.log('✅ Database table ready');
    importPoses();
});

async function importPoses() {
    const dances = ['danceone', 'dancetwo'];
    let imported = 0;
    const total = dances.length;
    
    for (const danceName of dances) {
        const jsonPath = path.join(__dirname, `${danceName}.json`);
        
        if (!fs.existsSync(jsonPath)) {
            console.log(`⚠️  File not found: ${jsonPath}`);
            imported++;
            if (imported === total) {
                await pool.end();
                process.exit(0);
            }
            continue;
        }
        
        try {
            console.log(`📖 Reading ${danceName}.json...`);
            const jsonData = fs.readFileSync(jsonPath, 'utf8');
            const poses = JSON.parse(jsonData);
            
            if (!Array.isArray(poses)) {
                console.error(`❌ Invalid format in ${danceName}.json - expected array`);
                imported++;
                if (imported === total) {
                    await pool.end();
                    process.exit(1);
                }
                continue;
            }
            
            const frameCount = poses.length;
            
            console.log(`💾 Importing ${frameCount} poses for ${danceName}...`);
            
            try {
                const result = await pool.query(
                    `INSERT INTO poses (dance_name, pose_data, frame_count, updated_at) 
                     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                     ON CONFLICT (dance_name) 
                     DO UPDATE SET pose_data = $2, frame_count = $3, updated_at = CURRENT_TIMESTAMP
                     RETURNING frame_count`,
                    [danceName, JSON.stringify(poses), frameCount]
                );
                
                console.log(`✅ Successfully imported ${frameCount} poses for ${danceName}`);
                imported++;
            } catch (dbError) {
                console.error(`❌ Error importing ${danceName}:`, dbError.message);
                imported++;
            }
            
            if (imported === total) {
                console.log('\n🎉 All poses imported successfully!');
                await pool.end();
                process.exit(0);
            }
        } catch (error) {
            console.error(`❌ Error processing ${danceName}.json:`, error.message);
            imported++;
            if (imported === total) {
                await pool.end();
                process.exit(1);
            }
        }
    }
}

