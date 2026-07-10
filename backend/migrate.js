const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'tripsync.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 1. Add join_code to trips table
    db.run(`ALTER TABLE trips ADD COLUMN join_code TEXT`, (err) => {
        if (err) {
            console.log("join_code might already exist:", err.message);
        } else {
            console.log("Added join_code to trips table.");
        }
    });

    // 2. Create trip_members table
    db.run(`CREATE TABLE IF NOT EXISTS trip_members (
        trip_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (trip_id, user_id)
    )`, (err) => {
        if (err) console.error("Error creating trip_members:", err.message);
        else console.log("trip_members table created.");
    });

    // 3. Migrate existing trips
    db.all(`SELECT id, user_id FROM trips`, [], (err, rows) => {
        if (err) return console.error(err);
        const stmt = db.prepare(`INSERT OR IGNORE INTO trip_members (trip_id, user_id) VALUES (?, ?)`);
        rows.forEach(row => {
            stmt.run([row.id, row.user_id]);
        });
        stmt.finalize();
        console.log("Migrated existing trip creators to trip_members.");
        
        const updateStmt = db.prepare(`UPDATE trips SET join_code = ? WHERE id = ? AND join_code IS NULL`);
        rows.forEach(row => {
            const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            updateStmt.run([randomCode, row.id]);
        });
        updateStmt.finalize();
        console.log("Added random join codes to existing trips.");
    });
});
