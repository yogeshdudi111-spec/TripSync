const API_URL = 'http://localhost:3000/api';

function getCurrencySymbol() {
    const cur = localStorage.getItem('currency') || 'INR';
    const symbols = {
        'INR': '₹',
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'JPY': '¥'
    };
    return symbols[cur] || '₹';
}

// Authentication Logic (index.html)
const authForm = document.getElementById('authForm');
if (authForm) {
    let isLogin = true;
    const toggleAuthBtn = document.getElementById('toggleAuth');
    const nameGroup = document.getElementById('nameGroup');
    const submitBtn = document.getElementById('submitBtn');
    
    toggleAuthBtn.addEventListener('click', () => {
        isLogin = !isLogin;
        nameGroup.style.display = isLogin ? 'none' : 'block';
        document.getElementById('nameInput').required = !isLogin;
        submitBtn.innerText = isLogin ? 'Sign In' : 'Sign Up';
        toggleAuthBtn.innerHTML = isLogin ? `Don't have an account? <span>Sign up</span>` : `Already have an account? <span>Sign in</span>`;
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('emailInput').value;
        const password = document.getElementById('passwordInput').value;
        const name = document.getElementById('nameInput').value;
        const errorDiv = document.getElementById('authError');

        try {
            const endpoint = isLogin ? '/login' : '/register';
            const body = isLogin ? { email, password } : { name, email, password };
            
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error);

            if (isLogin) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('name', data.name);
                window.location.href = 'dashboard.html';
            } else {
                isLogin = true;
                toggleAuthBtn.click(); // Switch back to login
                alert('Registration successful! Please login.');
            }
        } catch (error) {
            errorDiv.innerText = error.message;
        }
    });
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('name');
    window.location.href = 'index.html';
}

// Dashboard Fetching Logic (dashboard.html)
async function loadDashboardStats() {
    try {
        const res = await fetch(`${API_URL}/dashboard`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        
        document.getElementById('statTotalTrips').innerText = data.totalTrips;
        document.getElementById('statUpcomingTrips').innerText = data.upcomingTrips;
        document.getElementById('statTotalBudget').innerText = `${getCurrencySymbol()}${data.totalBudget.toLocaleString()}`;
        document.getElementById('statPendingTasks').innerText = data.pendingTasks;
    } catch (error) {
        console.error(error);
    }
}

async function loadTrips() {
    try {
        const res = await fetch(`${API_URL}/trips`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const trips = await res.json();
        const grid = document.getElementById('tripsGrid');
        grid.innerHTML = '';
        
        trips.forEach(trip => {
            const card = document.createElement('div');
            card.className = 'trip-feed-card';
            // In the next step we will build trip.html for details
            card.onclick = () => window.location.href = `trip.html?id=${trip.id}`;
            card.innerHTML = `
                <div>
                    <div class="trip-title">${trip.destination}</div>
                    <div class="trip-dates">${trip.start_date} to ${trip.end_date}</div>
                    <div class="trip-budget" style="margin-top:0.5rem;">Budget: ${getCurrencySymbol()}${trip.budget}</div>
                </div>
                <div class="join-code-badge" title="Share this code for others to join">CODE: ${trip.join_code}</div>
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        console.error(error);
    }
}

async function joinTrip() {
    const code = document.getElementById('joinCodeInput').value;
    if (!code) return;
    try {
        const res = await fetch(`${API_URL}/trips/join`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ join_code: code })
        });
        const data = await res.json();
        if (res.ok) {
            alert('Joined successfully!');
            document.getElementById('joinCodeInput').value = '';
            loadDashboardStats();
            loadTrips();
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error(error);
    }
}

// Add Trip Logic
const addTripModal = document.getElementById('addTripModal');
function openAddTripModal() { addTripModal.classList.add('active'); }
function closeAddTripModal() { addTripModal.classList.remove('active'); }

const addTripForm = document.getElementById('addTripForm');
if (addTripForm) {
    addTripForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const trip = {
            destination: document.getElementById('tripDest').value,
            start_date: document.getElementById('tripStart').value,
            end_date: document.getElementById('tripEnd').value,
            budget: parseFloat(document.getElementById('tripBudget').value),
            notes: document.getElementById('tripNotes').value
        };

        try {
            const res = await fetch(`${API_URL}/trips`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(trip)
            });
            if (res.ok) {
                closeAddTripModal();
                loadDashboardStats();
                loadTrips();
                addTripForm.reset();
            }
        } catch (error) {
            console.error(error);
        }
    });
}

// --- Trip Details & Charts Logic (trip.html) ---

let currentTripId = null;
let tripBudget = 0;
let budgetChartInstance = null;
let categoryChartInstance = null;
let taskChartInstance = null;

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

async function initTripDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    currentTripId = urlParams.get('id');
    if (!currentTripId) {
        window.location.href = 'dashboard.html';
        return;
    }

    await loadTripHeader();
    await fetchTripData();
}

async function loadTripHeader() {
    try {
        const res = await fetch(`${API_URL}/trips/${currentTripId}`, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`
            }
        });

        const trip = await res.json();

        if (!res.ok) {
            alert(trip.error || "Failed to load trip");
            window.location.href = "dashboard.html";
            return;
        }

        document.getElementById("tripTitle").innerText = trip.destination;
        document.getElementById("tripDates").innerText =
            `${trip.start_date} to ${trip.end_date}`;
        document.getElementById("tripJoinCode").innerText =
            trip.join_code;

        tripBudget = trip.budget;
        document.getElementById("lblBudget").innerText = `${getCurrencySymbol()}${tripBudget}`;

    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

async function fetchTripData() {
    try {
    const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
    
    const [itRes, tRes, exRes] = await Promise.all([
        fetch(`${API_URL}/trips/${currentTripId}/itinerary`, { headers }),
        fetch(`${API_URL}/trips/${currentTripId}/tasks`, { headers }),
        fetch(`${API_URL}/trips/${currentTripId}/expenses`, { headers })
    ]);

    const itineraries = await itRes.json();
    const tasks = await tRes.json();
    const expenses = await exRes.json();

    renderItinerary(itineraries);
    renderTasks(tasks);
    renderExpenses(expenses);
    renderCharts(expenses, tasks);
    loadSplitwise();
        } catch (err) {
    console.error(err);
    alert(err.message);
}
}

async function loadSplitwise() {
    const res = await fetch(`${API_URL}/trips/${currentTripId}/split`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    
    const container = document.getElementById('splitwiseList');
    if (!container) return;
    
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem; align-items: center;">
            <div style="font-size: 1.1rem; color: var(--text-muted);">Total: <span style="color: var(--text); font-weight: bold; font-size: 1.5rem;">${getCurrencySymbol()}${data.totalExpenses.toFixed(2)}</span></div>
            <div style="font-size: 1.1rem; color: var(--text-muted);">Per Person: <span style="color: var(--primary); font-weight: bold; font-size: 1.5rem;">${getCurrencySymbol()}${data.perPerson.toFixed(2)}</span></div>
        </div>
        <h4 style="color: var(--text-muted); margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">Team Members (${data.memberCount})</h4>
        <ul style="list-style: none;">
            ${data.members.map(m => `<li style="padding: 0.75rem 0; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--success);"></div>
                    <span>${m.name}</span>
                </div>
                <button class="btn" type="button" onclick="viewMemberProfile(this)" data-user-id="${m.id}" data-user-name="${m.name}" style="width: auto; padding: 0.3rem 0.75rem; font-size: 0.75rem; border-radius: 0.5rem; box-shadow: none;">View Trust Profile</button>
            </li>`).join('')}
        </ul>
    `;
}

function renderItinerary(items) {
    const container = document.getElementById('itineraryList');
    container.innerHTML = items.map(item => `
        <div class="list-item">
            <div>
                <strong>${item.day} - ${item.time}</strong><br>
                ${item.activity}
            </div>
            <div class="actions">
                <button onclick="deleteItem('itinerary', ${item.id})">X</button>
            </div>
        </div>
    `).join('');
}

function renderTasks(tasks) {
    const container = document.getElementById('taskList');
    container.innerHTML = tasks.map(task => `
        <div class="list-item">
            <div>
                <input type="checkbox" ${task.status === 'Completed' ? 'checked' : ''} onchange="updateTaskStatus(${task.id}, this.checked)">
                <strong>${task.title}</strong> (${task.priority})
            </div>
            <div class="actions">
                <button onclick="deleteItem('tasks', ${task.id})">X</button>
            </div>
        </div>
    `).join('');
}

function renderExpenses(expenses) {
    const container = document.getElementById('expenseList');
    container.innerHTML = expenses.map(exp => `
        <div class="list-item">
            <div>
                <strong>${exp.category}</strong> - ${getCurrencySymbol()}${exp.amount}<br>
                <small>${exp.date}</small>
            </div>
            <div class="actions">
                <button onclick="deleteItem('expenses', ${exp.id})">X</button>
            </div>
        </div>
    `).join('');
}

async function deleteItem(type, id) {
    if (confirm('Are you sure?')) {
        await fetch(`${API_URL}/${type}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        fetchTripData();
    }
}

async function updateTaskStatus(id, isCompleted) {
    await fetch(`${API_URL}/tasks/${id}`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: isCompleted ? 'Completed' : 'Pending' })
    });
    fetchTripData();
}

// Chart Rendering
function renderCharts(expenses, tasks) {
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    document.getElementById('lblSpent').innerText = `${getCurrencySymbol()}${totalSpent}`;

    // Budget vs Spent Chart
    const ctxBudget = document.getElementById('budgetChart').getContext('2d');
    if (budgetChartInstance) budgetChartInstance.destroy();
    budgetChartInstance = new Chart(ctxBudget, {
        type: 'doughnut',
        data: {
            labels: ['Spent', 'Remaining'],
            datasets: [{
                data: [totalSpent, Math.max(0, tripBudget - totalSpent)],
                backgroundColor: ['#ef4444', '#10b981'],
                borderWidth: 0
            }]
        },
        options: { plugins: { legend: { labels: { color: '#1e293b' } } } }
    });

    // Category Chart
    const categoryTotals = {};
    expenses.forEach(e => {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });
    const ctxCat = document.getElementById('categoryChart').getContext('2d');
    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(ctxCat, {
        type: 'pie',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#64748b'],
                borderWidth: 0
            }]
        },
        options: { plugins: { legend: { labels: { color: '#1e293b' } } } }
    });

    // Task Completion Chart
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const pending = tasks.length - completed;
    const ctxTask = document.getElementById('taskChart').getContext('2d');
    if (taskChartInstance) taskChartInstance.destroy();
    taskChartInstance = new Chart(ctxTask, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Pending'],
            datasets: [{
                data: [completed, pending],
                backgroundColor: ['#10b981', '#f59e0b'],
                borderWidth: 0
            }]
        },
        options: { plugins: { legend: { labels: { color: '#1e293b' } } } }
    });
}

// Form Listeners
if (document.getElementById('formItinerary')) {
    document.getElementById('formItinerary').addEventListener('submit', async (e) => {
        e.preventDefault();
        await fetch(`${API_URL}/trips/${currentTripId}/itinerary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({
                day: document.getElementById('itDay').value,
                time: document.getElementById('itTime').value,
                activity: document.getElementById('itActivity').value
            })
        });
        closeModal('itineraryModal');
        document.getElementById('formItinerary').reset();
        fetchTripData();
    });

    document.getElementById('formTask').addEventListener('submit', async (e) => {
        e.preventDefault();
        await fetch(`${API_URL}/trips/${currentTripId}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({
                title: document.getElementById('tTitle').value,
                priority: document.getElementById('tPriority').value
            })
        });
        closeModal('taskModal');
        document.getElementById('formTask').reset();
        fetchTripData();
    });

    document.getElementById('formExpense').addEventListener('submit', async (e) => {
        e.preventDefault();
        await fetch(`${API_URL}/trips/${currentTripId}/expenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({
                category: document.getElementById('exCategory').value,
                amount: parseFloat(document.getElementById('exAmount').value),
                date: document.getElementById('exDate').value
            })
        });
        closeModal('expenseModal');
        document.getElementById('formExpense').reset();
        fetchTripData();
    });
}

// --- USER PROFILE & TRUST VERIFICATION CLIENT LOGIC ---

async function loadUserProfile() {
    try {
        const res = await fetch(`${API_URL}/profile`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        
        // Populate inputs
        if (document.getElementById('profAge')) document.getElementById('profAge').value = data.age || '';
        if (document.getElementById('profGender')) document.getElementById('profGender').value = data.gender || '';
        if (document.getElementById('profPhone')) document.getElementById('profPhone').value = data.phone || '';
        if (document.getElementById('profResidence')) document.getElementById('profResidence').value = data.residence || '';
        if (document.getElementById('profBio')) document.getElementById('profBio').value = data.bio || '';
        if (document.getElementById('profEmergency')) document.getElementById('profEmergency').value = data.emergency_contact || '';
        
        updateTrustMetrics(data.trust_score);
    } catch (err) {
        console.error(err);
    }
}

function updateTrustMetrics(trustScore) {
    const scoreText = document.getElementById('lblTrustScore');
    const barFill = document.getElementById('pbTrustScore');
    
    if (scoreText) scoreText.innerText = `${trustScore}%`;
    if (barFill) barFill.style.width = `${trustScore}%`;
}

// Profile Save Listener
const profileForm = document.getElementById('profileForm');
if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const profileData = {
            age: parseInt(document.getElementById('profAge').value) || null,
            gender: document.getElementById('profGender').value,
            phone: document.getElementById('profPhone').value,
            residence: document.getElementById('profResidence').value,
            bio: document.getElementById('profBio').value,
            emergency_contact: document.getElementById('profEmergency').value
        };

        try {
            const res = await fetch(`${API_URL}/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(profileData)
            });
            const data = await res.json();
            if (res.ok) {
                alert('Profile details updated successfully!');
                loadUserProfile();
            } else {
                alert(data.error || 'Failed to update profile');
            }
        } catch (err) {
            console.error(err);
        }
    });
}

// Teammate Profile Viewer Modal trigger
async function viewMemberProfile(el) {
    const userId = el.getAttribute('data-user-id');
    const userName = el.getAttribute('data-user-name');
    try {
        const res = await fetch(`${API_URL}/users/${userId}/profile`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const profile = await res.json();
        
        document.getElementById('mProfTitle').innerText = `${userName}'s Trust Profile`;
        document.getElementById('mProfAge').innerText = profile.age || 'Not specified';
        document.getElementById('mProfGender').innerText = profile.gender || 'Not specified';
        document.getElementById('mProfResidence').innerText = profile.residence || 'Not specified';
        document.getElementById('mProfPhone').innerText = profile.phone || 'Not specified';
        document.getElementById('mProfEmergency').innerText = profile.emergency_contact || 'Not specified';
        document.getElementById('mProfBio').innerText = profile.bio || 'No details provided yet.';
        
        const score = document.getElementById('mProfScore');
        if (score) score.innerText = `${profile.trust_score}%`;
        
        openModal('memberProfileModal');
    } catch (err) {
        console.error(err);
        alert('Failed to load traveler profile');
    }
}

