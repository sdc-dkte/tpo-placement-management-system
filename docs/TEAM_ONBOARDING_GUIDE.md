# DKTE Placement Management System — Team Onboarding & Local Setup Guide

This guide enables any team member to clone the repository, run the local PostgreSQL database, start the backend and frontend servers, and immediately log in with the pre-seeded **TPO Administrator** and **Student** demo accounts.

---

## 1. Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: v18 or v20+ (`node -v`)
- **PostgreSQL**: v14, v15, or v16 (`psql --version`)
- **Git**

---

## 2. Step-by-Step Setup

### Step 1: Clone and Branch
```bash
git clone https://github.com/sdc-dkte/tpo-placement-management-system.git
cd tpo-placement-management-system
git checkout feature/frontend-auth-student-import
```

---

### Step 2: Database Initialization

1. Start your local PostgreSQL service:
   - **macOS (Homebrew):** `brew services start postgresql@16`
   - **Linux (Ubuntu/Debian):** `sudo systemctl start postgresql`
   - **Windows:** Ensure the PostgreSQL service is running in Windows Services or pgAdmin.

2. Create the project database:
   ```bash
   createdb tpo_placement_db
   ```
   *(Or inside `psql`: `CREATE DATABASE tpo_placement_db;`)*

---

### Step 3: Backend Configuration & Seeding

1. Navigate to the backend directory and install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Create your `.env` file from the provided template:
   ```bash
   cp .env.example .env
   ```

3. Open `.env` and verify your `DATABASE_URL`:
   ```env
   PORT=5001
   CLIENT_URL=http://localhost:3000
   DATABASE_URL="postgresql://YOUR_POSTGRES_USER:YOUR_POSTGRES_PASSWORD@localhost:5432/tpo_placement_db?schema=public"
   ```
   *(Note: Port `5001` is used to avoid macOS AirPlay Receiver port `5000` conflicts).*

4. Push the Prisma database schema and run the seed script:
   ```bash
   npx prisma db push
   node prisma/seed.js
   ```

   **Expected Output:**
   ```text
   Departments seeded successfully.
   Initial TPO account created: tpo@dkte.ac.in
   Demo Student account created: student@dkte.ac.in (Password: 24UAD065)
   ```

5. Start the backend development server:
   ```bash
   npm run dev
   ```
   *The backend will be running at `http://localhost:5001`.*

---

### Step 4: Frontend Startup

Open a **new terminal tab/window**:

1. Navigate to the frontend directory and install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend will launch at `http://localhost:3000`.*

---

## 3. Pre-Seeded Testing Accounts

Open **`http://localhost:3000/login`** in your browser.

You can click the one-click **Demo Accounts** buttons at the bottom of the sign-in card, or manually enter:

| Role | Institutional Email | Password | Destination Dashboard |
| :--- | :--- | :--- | :--- |
| **Student** | `student@dkte.ac.in` | `24UAD065` *(PRN)* | `/portal/dossier` |
| **TPO Administrator** | `tpo@dkte.ac.in` | `Admin@1234` | `/dashboard` |

---

## 4. Troubleshooting Common Issues

- **PostgreSQL Connection Refused (`ECONNREFUSED 127.0.0.1:5432`):**
  Ensure your PostgreSQL server is running. Test with `pg_isready`.
- **Port 5000 403 Forbidden Error (macOS):**
  macOS uses port 5000 for AirPlay Receiver (ControlCenter). Always use port **`5001`** as configured in `.env.example`.
- **Database Tables Not Found:**
  Run `npx prisma db push` inside the `backend` folder to sync the Prisma models.
