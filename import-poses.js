const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const db = new sqlite3.Database('dance_poses.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
        process.exit(1);
    }
    
    // Create table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS poses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dance_name TEXT UNIQUE NOT NULL,
        pose_data TEXT NOT NULL,
        frame_count INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating table:', err);
            process.exit(1);
        }
        
        importPoses();
    });
});

function importPoses() {
    const dances = ['danceone', 'dancetwo'];
    let completed = 0;
    const total = dances.length;
    
    dances.forEach((danceName) => {
        const jsonPath = path.join(__dirname, `${danceName}.json`);
        
        if (!fs.existsSync(jsonPath)) {
            console.log(`⚠️  File not found: ${jsonPath}`);
            completed++;
            if (completed === total) {
                db.close();
            }
            return;
        }
        
        try {
            console.log(`📖 Reading ${danceName}.json...`);
            const jsonData = fs.readFileSync(jsonPath, 'utf8');
            const poses = JSON.parse(jsonData);
            
            if (!Array.isArray(poses)) {
                console.error(`❌ Invalid format in ${danceName}.json - expected array`);
                completed++;
                if (completed === total) {
                    db.close();
                }
                return;
            }
            
            const poseData = JSON.stringify(poses);
            const frameCount = poses.length;
            
            console.log(`💾 Importing ${frameCount} poses for ${danceName}...`);
            
            db.run(
                `INSERT OR REPLACE INTO poses (dance_name, pose_data, frame_count, updated_at) 
                 VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
                [danceName, poseData, frameCount],
                function(err) {
                    completed++;
                    if (err) {
                        console.error(`❌ Error importing ${danceName}:`, err);
                    } else {
                        console.log(`✅ Successfully imported ${frameCount} poses for ${danceName}`);
                    }
                    
                    if (completed === total) {
                        console.log('\n🎉 All poses imported successfully!');
                        setTimeout(() => {
                            db.close((err) => {
                                if (err) {
                                    console.error('Error closing database:', err);
                                }
                                process.exit(0);
                            });
                        }, 100);
                    }
                }
            );
        } catch (error) {
            completed++;
            console.error(`❌ Error processing ${danceName}.json:`, error.message);
            if (completed === total) {
                db.close();
            }
        }
    });
}

