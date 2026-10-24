# DKTE Placement Management System — Frontend Developer Onboarding Guide

Welcome to the **DKTE Placement Management System**! This guide is specifically written for **frontend student developers**. 

If your primary focus is React, Tailwind CSS, and UI components, you might wonder:  
> *"Why do I need a backend server and database running just to build UI?"*  
> *"How do frontend and backend connect, and how do I run them without being a backend engineer?"*

This guide answers everything in simple terms, with step-by-step commands to get you coding in under 5 minutes.

---

## 1. How Frontend & Backend Work Together

When developing this application, your machine runs two servers side by side:

```
┌──────────────────────────────────────────────┐
│             Your Web Browser                 │
│         http://localhost:3000/login          │
└──────────────────────┬───────────────────────┘
                       │
       1. UI & Assets  │  2. API Calls (/api/v1/...)
                       ▼
┌──────────────────────────────────────────────┐
│         Vite Dev Server (Frontend)           │
│             Port: 3000 (React 19)            │
│  - Serves React pages, Tailwind, images      │
│  - Proxies all `/api/*` calls to Port 5001   │
└──────────────────────┬───────────────────────┘
                       │
                       │ 3. Forwarded REST Requests
                       ▼
┌──────────────────────────────────────────────┐
│        Express.js API Server (Backend)       │
│             Port: 5001 (Node.js)             │
│  - Checks passwords with bcrypt              │
│  - Issues JWT tokens for session auth        │
│  - Fetches student dossiers & drive info     │
└──────────────────────┬───────────────────────┘
                       │
                       │ 4. SQL Queries (via Prisma ORM)
                       ▼
┌──────────────────────────────────────────────┐
│             PostgreSQL Database              │
│                 Port: 5432                   │
│  - Stores Users, Students, Departments, etc. │
└──────────────────────────────────────────────┘
```

### Why we run a local backend:
- **Real Authentication:** You can test logging in as a **Student** or **TPO Administrator** and see real role-based dashboard switching.
- **No Mock Data Hacks:** Instead of hardcoding fake arrays in your components, your frontend calls real backend endpoints (`POST /api/v1/auth/login`, `GET /api/v1/auth/me`).
- **Seamless Token Management:** The backend issues a JWT token, which our frontend automatically saves in `localStorage` and attaches to future requests.

---

## 2. Quick Setup: 3 Steps to Run Everything

### Step 1: Start PostgreSQL Database (One-time)

Make sure PostgreSQL is running on your machine:
- **macOS:** `brew services start postgresql@16`
- **Windows:** Ensure PostgreSQL service is running in Windows Services or pgAdmin.
- **Linux:** `sudo systemctl start postgresql`

Create the database (run once in terminal):
```bash
createdb tpo_placement_db
```
*(If prompted for password, enter your local PostgreSQL password).*

---

### Step 2: Start the Backend (Terminal 1)

Open your first terminal window:

```bash
cd backend
npm install
cp .env.example .env
```

1. Open `backend/.env` in your editor and check the `DATABASE_URL` line:
   ```env
   PORT=5001
   CLIENT_URL=http://localhost:3000
   DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/tpo_placement_db?schema=public"
   ```
   *(Replace `YOUR_USER` and `YOUR_PASSWORD` with your PostgreSQL username/password, e.g., `postgres` / `postgres`).*

2. Create tables & inject demo testing accounts:
   ```bash
   npx prisma db push
   node prisma/seed.js
   ```
   > **You will see:**  
   > `Departments seeded successfully.`  
   > `Initial TPO account created: tpo@dkte.ac.in`  
   > `Demo Student account created: student@dkte.ac.in (Password: 24UAD065)`

3. Start backend:
   ```bash
   npm run dev
   ```
   *Leave this terminal open. It runs at `http://localhost:5001`.*

---

### Step 3: Start the Frontend (Terminal 2)

Open a second terminal window:

```bash
cd frontend
npm install
npm run dev
```

*Open your browser at **`http://localhost:3000`**!*

---

## 3. How to Test Your Frontend

Open **`http://localhost:3000/login`** in your browser.

Under **Demo Accounts**, click the one-click quick fill buttons:

| Demo Button | Credentials | What Happens Upon Sign In |
| :--- | :--- | :--- |
| **Student** | `student@dkte.ac.in` / `24UAD065` | Logs in as Rahul Patil, routes to [`/portal/dossier`](file:///Users/Farooq/tpo-placement-management-system/frontend/src/pages/student/StudentDossierPage.jsx) |
| **TPO Admin** | `tpo@dkte.ac.in` / `Admin@1234` | Logs in with admin privileges, routes to [`/dashboard`](file:///Users/Farooq/tpo-placement-management-system/frontend/src/pages/tpo/TpoDashboardPage.jsx) |

Click **Sign Out** in the top navigation bar to clear the session and return to `/login`.

---

## 4. Frontend Developer Cheat Sheet: How to Code

### A. How to Call the Backend from React
Never hardcode `http://localhost:5001`! Vite proxies `/api` calls automatically.

Use the shared API client in [`frontend/src/api/client.js`](file:///Users/Farooq/tpo-placement-management-system/frontend/src/api/client.js):

```javascript
import { apiClient } from '../api/client';

// Example GET request (automatically attaches JWT token if logged in)
const data = await apiClient('/auth/me');

// Example POST request
const result = await apiClient('/auth/login', {
  method: 'POST',
  body: { email, password },
});
```

### B. How to Access the Logged-In User in Any Component
Use the `useAuth` hook from [`frontend/src/context/useAuth.js`](file:///Users/Farooq/tpo-placement-management-system/frontend/src/context/useAuth.js):

```jsx
import { useAuth } from '../../context/useAuth';

export default function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <div>
      <p>Logged in as: {user?.name} ({user?.role})</p>
      <button onClick={logout}>Sign Out</button>
    </div>
  );
}
```

### C. Design System & Styling Rules
Always follow the guidelines in [`frontend/docs/DESIGN_SYSTEM_AND_PRODUCT_GUIDELINES.md`](file:///Users/Farooq/tpo-placement-management-system/frontend/docs/DESIGN_SYSTEM_AND_PRODUCT_GUIDELINES.md):
- **Primary Color:** DKTE Gold `#FECC00` (used for primary actions & accents).
- **Text & Contrast:** Near-black `#111827` on gold buttons; `#1F2937` for body text.
- **Borders & Radii:** 1px hairline borders (`border-gray-200`), 4px border radius (`rounded`).
- **Icons:** Use `lucide-react` (e.g. `import { User, Lock, Building2 } from 'lucide-react';`).
- **Typography:** `Inter` font, with numbers styled using `tabular-nums`.

---

## 5. Troubleshooting for Frontend Developers

### 1. `Failed to fetch` or `Network Error`
- **Cause:** The backend server in Terminal 1 is not running.
- **Fix:** In Terminal 1, run `cd backend && npm run dev`. Make sure it says `TPO API running at http://localhost:5001`.

### 2. `Invalid credentials` when clicking Demo Accounts
- **Cause:** The database was created but not seeded with the demo accounts.
- **Fix:** In `backend/`, run `node prisma/seed.js`.

### 3. macOS Port 5000 `403 Forbidden`
- **Cause:** macOS uses port 5000 for Apple AirPlay (`ControlCenter`).
- **Fix:** Our project is configured to use port **`5001`**. Always ensure `PORT=5001` in `backend/.env`.

### 4. Need to check if database tables exist?
You can use Prisma Studio (a visual web database viewer):
```bash
cd backend
npx prisma studio
```
*This opens a browser tab at `http://localhost:5555` where you can see all users, students, and departments in a visual spreadsheet!*

---

Happy Coding! For any questions, reach out on the team channel or check with the project maintainer.
