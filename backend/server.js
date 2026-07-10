const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./database'); // This initializes the database connection and creates tables

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json()); // To parse JSON bodies

app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
});

// Basic welcome route
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the TripSync Lite Backend API' });
});

const SECRET_KEY = 'tripsync_super_secret'; // Hardcoded for simplicity

// Middleware to authenticate JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });
    
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

// --- AUTHENTICATION ROUTES ---
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (name, email, password) VALUES (?, ?, ?)`, [name, email, hashedPassword], function(err) {
            if (err) return res.status(400).json({ error: 'Email already exists' });
            res.status(201).json({ message: 'User registered successfully', userId: this.lastID });
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });
        
        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ message: 'Login successful', token, name: user.name });
    });
});

// --- TRIPS ROUTES (Protected) ---
app.get('/api/trips', authenticateToken, (req, res) => {
    db.all(`SELECT trips.* FROM trips JOIN trip_members ON trips.id = trip_members.trip_id WHERE trip_members.user_id = ?`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/trips', authenticateToken, (req, res) => {
    const { destination, start_date, end_date, budget, notes } = req.body;
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    db.run(`INSERT INTO trips (user_id, destination, start_date, end_date, budget, notes, join_code) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
        [req.user.id, destination, start_date, end_date, budget, notes, joinCode], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const tripId = this.lastID;
            db.run(`INSERT INTO trip_members (trip_id, user_id) VALUES (?, ?)`, [tripId, req.user.id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({ message: 'Trip created', tripId, join_code: joinCode });
            });
        });
});

app.post('/api/trips/join', authenticateToken, (req, res) => {
    const { join_code } = req.body;
    db.get(`SELECT id FROM trips WHERE join_code = ?`, [join_code.toUpperCase()], (err, trip) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!trip) return res.status(404).json({ error: 'Invalid join code' });
        
        db.run(`INSERT OR IGNORE INTO trip_members (trip_id, user_id) VALUES (?, ?)`, [trip.id, req.user.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Successfully joined trip', tripId: trip.id });
        });
    });
});

app.get('/api/trips/:id', authenticateToken, (req, res) => {
    console.log("Trip ID:", req.params.id);
console.log("User:", req.user);
    
    db.get(`SELECT trips.* FROM trips JOIN trip_members ON trips.id = trip_members.trip_id WHERE trips.id = ? AND trip_members.user_id = ?`, [req.params.id, req.user.id], (err, trip) => {
       if (err) {
    console.log(err);
    return res.status(500).json({ error: err.message });
}
        if (!trip) return res.status(404).json({ error: 'Trip not found or unauthorized' });
        res.json(trip);
    });
});

app.put('/api/trips/:id', authenticateToken, (req, res) => {
    const { destination, start_date, end_date, budget, notes } = req.body;
    db.run(`UPDATE trips SET destination = ?, start_date = ?, end_date = ?, budget = ?, notes = ? WHERE id = ? AND user_id = ?`,
        [destination, start_date, end_date, budget, notes, req.params.id, req.user.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Trip not found or unauthorized' });
            res.json({ message: 'Trip updated successfully' });
        });
});

app.delete('/api/trips/:id', authenticateToken, (req, res) => {
    db.run(`DELETE FROM trips WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Trip not found or unauthorized' });
        res.json({ message: 'Trip deleted successfully' });
    });
});

// --- ITINERARY ROUTES ---
app.get('/api/trips/:tripId/itinerary', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM itinerary WHERE trip_id = ?`, [req.params.tripId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/trips/:tripId/itinerary', authenticateToken, (req, res) => {
    const { day, activity, time } = req.body;
    db.run(`INSERT INTO itinerary (trip_id, day, activity, time) VALUES (?, ?, ?, ?)`, 
        [req.params.tripId, day, activity, time], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: 'Itinerary added', id: this.lastID });
    });
});

app.delete('/api/itinerary/:id', authenticateToken, (req, res) => {
    db.run(`DELETE FROM itinerary WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Itinerary deleted' });
    });
});

// --- TASKS ROUTES ---
app.get('/api/trips/:tripId/tasks', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM tasks WHERE trip_id = ?`, [req.params.tripId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/trips/:tripId/tasks', authenticateToken, (req, res) => {
    const { title, status, priority } = req.body;
    db.run(`INSERT INTO tasks (trip_id, title, status, priority) VALUES (?, ?, ?, ?)`, 
        [req.params.tripId, title, status || 'Pending', priority || 'Medium'], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: 'Task added', id: this.lastID });
    });
});

app.put('/api/tasks/:id', authenticateToken, (req, res) => {
    const { status } = req.body;
    db.run(`UPDATE tasks SET status = ? WHERE id = ?`, [status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Task updated' });
    });
});

app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
    db.run(`DELETE FROM tasks WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Task deleted' });
    });
});

// --- EXPENSES ROUTES ---
app.get('/api/trips/:tripId/split', authenticateToken, (req, res) => {
    db.all(`SELECT users.name, users.id FROM trip_members JOIN users ON trip_members.user_id = users.id WHERE trip_id = ?`, [req.params.tripId], (err, members) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.get(`SELECT SUM(amount) as total FROM expenses WHERE trip_id = ?`, [req.params.tripId], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            const total = result.total || 0;
            const perPerson = total / (members.length || 1);
            res.json({ totalExpenses: total, memberCount: members.length, perPerson, members });
        });
    });
});

app.get('/api/trips/:tripId/expenses', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM expenses WHERE trip_id = ?`, [req.params.tripId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/trips/:tripId/expenses', authenticateToken, (req, res) => {
    const { category, amount, date } = req.body;
    db.run(`INSERT INTO expenses (trip_id, category, amount, date) VALUES (?, ?, ?, ?)`, 
        [req.params.tripId, category, amount, date], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: 'Expense added', id: this.lastID });
    });
});

app.delete('/api/expenses/:id', authenticateToken, (req, res) => {
    db.run(`DELETE FROM expenses WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Expense deleted' });
    });
});

// --- USER PROFILES & TRUST VERIFICATION ROUTES ---
app.get('/api/profile', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.get(`SELECT * FROM user_profiles WHERE user_id = ?`, [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) {
            return res.json({
                user_id: userId,
                age: '',
                gender: '',
                phone: '',
                residence: '',
                bio: '',
                emergency_contact: '',
                is_verified: 0,
                trust_score: 65
            });
        }
        res.json(row);
    });
});

app.put('/api/profile', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { age, gender, phone, residence, bio, emergency_contact } = req.body;
    
    // Calculate trust score based on profile completeness (summing up to 100%)
    let score = 0;
    if (age) score += 15;
    if (gender) score += 15;
    if (phone) score += 25;
    if (residence) score += 15;
    if (bio) score += 15;
    if (emergency_contact) score += 15;

    db.get(`SELECT user_id FROM user_profiles WHERE user_id = ?`, [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!row) {
            db.run(`INSERT INTO user_profiles (user_id, age, gender, phone, residence, bio, emergency_contact, trust_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, age, gender, phone, residence, bio, emergency_contact, score],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Profile created', trust_score: score });
                });
        } else {
            db.run(`UPDATE user_profiles SET age = ?, gender = ?, phone = ?, residence = ?, bio = ?, emergency_contact = ?, trust_score = ? WHERE user_id = ?`,
                [age, gender, phone, residence, bio, emergency_contact, score, userId],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Profile updated', trust_score: score });
                });
        }
    });
});

app.get('/api/users/:id/profile', authenticateToken, (req, res) => {
    const requesterId = req.user.id;
    const targetId = parseInt(req.params.id);
    
    if (requesterId === targetId) {
        db.get(`SELECT * FROM user_profiles WHERE user_id = ?`, [targetId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.json({ user_id: targetId, age: '', gender: '', phone: '', residence: '', bio: '', emergency_contact: '', is_verified: 0, trust_score: 65 });
            return res.json(row);
        });
        return;
    }

    // Privacy check: verify requesting user and target user share at least one trip
    const shareQuery = `
        SELECT COUNT(*) as count 
        FROM trip_members tm1
        JOIN trip_members tm2 ON tm1.trip_id = tm2.trip_id
        WHERE tm1.user_id = ? AND tm2.user_id = ?
    `;
    
    db.get(shareQuery, [requesterId, targetId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const shareTrip = result.count > 0;
        
        db.get(`SELECT * FROM user_profiles WHERE user_id = ?`, [targetId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            
            let profile = row || {
                user_id: targetId,
                age: '',
                gender: '',
                phone: '',
                residence: '',
                bio: '',
                emergency_contact: '',
                is_verified: 0,
                trust_score: 65
            };

            if (!shareTrip) {
                // Redact sensitive contact fields if not in the same team
                profile.phone = '[Hidden - Join a Trip together to view]';
                profile.emergency_contact = '[Hidden - Join a Trip together to view]';
            }
            
            res.json(profile);
        });
    });
});

// --- DASHBOARD STATS ---
app.get('/api/dashboard', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    const getTrips = () => new Promise((resolve, reject) => {
        db.all(`SELECT trips.* FROM trips JOIN trip_members ON trips.id = trip_members.trip_id WHERE trip_members.user_id = ?`, [userId], (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    });

    const getTasks = () => new Promise((resolve, reject) => {
        db.all(`SELECT tasks.* FROM tasks JOIN trip_members ON tasks.trip_id = trip_members.trip_id WHERE trip_members.user_id = ?`, [userId], (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    });

    Promise.all([getTrips(), getTasks()]).then(([trips, tasks]) => {
        const totalTrips = trips.length;
        const totalBudget = trips.reduce((sum, trip) => sum + trip.budget, 0);
        
        const today = new Date().toISOString().split('T')[0];
        const upcomingTrips = trips.filter(t => t.start_date >= today);
        
        res.json({
            totalTrips,
            upcomingTrips: upcomingTrips.length,
            totalBudget,
            totalTasks: tasks.length,
            pendingTasks: tasks.filter(t => t.status !== 'Completed').length
        });
    }).catch(err => {
        res.status(500).json({ error: err.message });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
