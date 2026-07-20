# TripSync ✈️

TripSync is a modern, collaborative group travel planner and financial split platform. It allows co-travelers to sync their itineraries, checklist tasks, split expenses, and verify traveler trust profiles within a secure, responsive dashboard.

---

## 🌟 Key Features

1. **Collaborative Itinerary Planner**: Schedule trip activities by day and time.
2. **Shared Task Checklist**: Delegate and track task checklist items with priority tags (High/Medium/Low).
3. **Smart Expense Tracker & Splitter**: Log spending by category and calculate per-person splits automatically (Splitwise core mechanics).
4. **Dynamic Currency Selection**: Instantly switch the global currency interface (supports INR ₹, USD $, EUR €, GBP £, JPY ¥).
5. **Traveler Trust Profile**: Dynamically calculates a Profile Completeness score (0-100%) based on completed details (Age, Gender, Residence, Bio, Emergency Contact).
6. **🔒 Privacy Protection Guard**: Automatically redacts sensitive fields (Phone and Emergency Contacts) from traveler cards unless the viewing traveler and target traveler share at least one active trip.
7. **Premium Glassmorphic Design**: Clean Light-Mode theme based on Coastal Teal and Seafoam-Sage accents, complete with natural background overlays.

---

## 🛠️ Technology Stack

*   **Frontend**: HTML5, Vanilla CSS3 (custom variables), JavaScript (ES6+), Chart.js (for analytics).
*   **Backend**: Node.js, Express.js.
*   **Database**: SQLite (`sqlite3` wrapper).
*   **Security**: Bcrypt (password hashing), JSON Web Tokens (JWT authentication).

---

## 🚀 Installation & Setup Guide

Follow these steps to clone, install, and run this repository on another device:

### Prerequisites

Ensure you have the following installed on the target device:
*   [Node.js](https://nodejs.org/) (Version 16.x or higher recommended)
*   A modern web browser (Chrome, Firefox, Safari, Edge, etc.)

---

### Step 1: Clone the Repository

Clone the project folder onto your target machine:
```bash
git clone https://github.com/yogeshdudi111/TripSync.git
cd TripSync
```

---

### Step 2: Install Backend Dependencies

Navigate to the `backend` directory and install the required npm packages:
```bash
cd backend
npm install
```
This installs the following packages:
*   `express` (REST API server)
*   `cors` (cross-origin resource sharing middleware)
*   `bcrypt` (password encryption)
*   `jsonwebtoken` (JWT user session tokens)
*   `sqlite3` (database driver)

---

### Step 3: Run the Backend Server

To start the API backend server:
```bash
node server.js
```
The server will run on **`http://localhost:3000`**. On startup:
*   The connection to the SQLite database is automatically established.
*   If the database file (`tripsync.sqlite`) does not exist, it will be created automatically in the backend directory.
*   All necessary database tables (`users`, `trips`, `trip_members`, `itinerary`, `tasks`, `expenses`, `user_profiles`) are initialized.

---

### Step 4: Launch the Frontend Client

Since the frontend is built using standard Web APIs and static files (HTML/CSS/JS), you can load it in two ways:

#### Option A: Direct File Open (Easiest)
Navigate to the `frontend` folder and open **`index.html`** directly in any web browser.

#### Option B: Live Server (Recommended)
If using VS Code, install the **Live Server** extension, right-click `index.html` in the `frontend` folder, and select **"Open with Live Server"**.
This serves the client files locally on `http://127.0.0.1:5500` or similar port.

---

## 📂 Project Structure

```text
TripSync/
├── backend/
│   ├── database.js          # SQLite connection and schema migrations
│   ├── server.js            # Express API server configuration & routing
│   ├── package.json         # Node server dependencies
│   └── tripsync.sqlite      # Active SQLite database file (created on startup)
├── frontend/
│   ├── index.html           # Authentication / Login & Sign-up onboarding
│   ├── dashboard.html       # Trip listing and currency selectors
│   ├── trip.html            # Trip detail workspace (Checklist, Itinerary, Expense charts)
│   ├── profile.html         # User Profile & Completeness Score panel
│   ├── app.js               # Core client-side API fetches and dynamic rendering
│   ├── styles.css           # Custom glassmorphic CSS styling rules
│   └── travel-bg.jpg        # Background graphic asset
└── README.md
```

---

## 🔒 Verification & API Endpoints

### Auth Routes
*   `POST /api/register` - Create a new co-traveler account.
*   `POST /api/login` - Verify password and return a JWT auth token.

### Trip Routes
*   `POST /api/trips` - Create a new trip.
*   `GET /api/trips` - Retrieve trips current user is member of.
*   `POST /api/trips/join` - Join an existing trip using a unique Join Code.

### Work Routes
*   `GET /api/trips/:id/itinerary` | `POST /api/trips/:id/itinerary` - Manage itineraries.
*   `GET /api/trips/:id/tasks` | `POST /api/trips/:id/tasks` - Manage delegacy checklists.
*   `GET /api/trips/:id/expenses` | `POST /api/trips/:id/expenses` - Manage expense logs.
*   `GET /api/trips/:id/split` - Returns total expenses, per-person share, and debt breakdowns.

### Profiles & Privacy Routes
*   `GET /api/profile` - Retrieve current logged-in user's profile completeness details.
*   `PUT /api/profile` - Update profile data & recalculate Trust Score.
*   `GET /api/users/:id/profile` - Privacy-protected request to inspect a co-traveler's profile card (requires a shared trip to display contact fields; otherwise, redacts them).

---

## 👨‍💻 Developer

**Yogesh Dudi**

GitHub: https://github.com/yogeshdudi111-spec

---

## ⭐ Support

If you like this project, consider giving it a ⭐ on GitHub.
