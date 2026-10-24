# DKTE Placement Management System — Frontend

The modern, institutional frontend for the Central Training & Placement Cell at D.K.T.E. Society's Textile & Engineering Institute.

---

## 🚀 Quickstart for Frontend Developers

If you are a student developer working on the UI, start by reading the **[Frontend Developer Onboarding Guide](docs/FRONTEND_TEAM_ONBOARDING_GUIDE.md)**.

It explains:
- How the frontend connects to the backend API (`/api` proxy $\to$ port 5001).
- How to start PostgreSQL and the backend in 2 minutes so your login and API endpoints work.
- How to use the `useAuth()` hook and `apiClient` in React components.

---

## 🎨 Design System & Guidelines

Before creating or editing any components, review **[Design System & Product Guidelines](docs/DESIGN_SYSTEM_AND_PRODUCT_GUIDELINES.md)**:
- **Primary Color:** DKTE Gold `#FECC00`
- **Text & Surface:** Near-black `#111827`, pure white `#FFFFFF`, subtle slate `#F8FAFC`
- **Radii:** `ROUND_FOUR` (4px radius / `rounded`)
- **Hairlines:** 1px borders (`border-gray-200`)
- **Icons:** `lucide-react`
- **Typography:** `Inter` font, `tabular-nums` for numerical data

---

## 🛠️ Running Frontend Locally

```bash
# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev
# Running at http://localhost:3000

# 3. Lint code
npm run lint

# 4. Test production build
npm run build
```

*(Note: Ensure your backend server is running in another terminal on port 5001 as explained in the [Onboarding Guide](docs/FRONTEND_TEAM_ONBOARDING_GUIDE.md)).*
