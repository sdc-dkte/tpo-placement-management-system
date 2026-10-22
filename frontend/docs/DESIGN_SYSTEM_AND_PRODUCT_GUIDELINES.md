# DKTE Placement Console — Design System & Product Guidelines

> **Status:** Final Agreed Specification  
> **Target Application:** DKTE Placement Management System (`sdc-dkte/tpo-placement-management-system`)  
> **Audience:** Frontend Developers, UI Engineers, Full-Stack Contributors, and QA  
> **Design Philosophy:** Disciplined enterprise SaaS (Linear / Stripe inspired institutional console)

---

## 1. Brand Identity & Design Principles

The DKTE Placement Console is designed for high-stakes institutional placement operations. It bridges institutional administrators (TPO Head, Placement Coordinators, Departmental TPOs) with recruiters and graduating students.

### Core Visual Principles
1. **Disciplined Enterprise Density:**
   - Maximized informational density without visual noise.
   - Flat 0-shadow layout with 1px hairline border contrast (`border border-gray-200` / `#E5E7EB`).
   - Cards, tables, and metric strips are cleanly contained within 1px hairlines.

2. **The 5–10% DKTE Golden Yellow Budget:**
   - Official DKTE Gold (`#FECC00`) is the signature brand accent.
   - **Strict Usage Rule:** Yellow is strictly used as a fill or container:
     - Single primary action button per screen (e.g., `+ Post New Drive`).
     - Active sidebar navigation indicator.
     - Active tab bottom indicator underline (`All Drives (28)`).
     - Super Dream recruitment tier indicator badge (`≥ ₹10.00 LPA`).
   - **Contrast Rule:** Text on yellow surfaces is **always near-black (`#111827`)**, providing an accessible 12:1+ contrast ratio. **Never render yellow text on white or light gray surfaces.**

3. **Tabular Numerics for Instant Scannability:**
   - All financial figures (`₹24.00 LPA`), dates (`12 Nov 2026`), and candidate counts (`342 eligible`) must utilize tabular numbers (`tabular-nums` / `font-feature-settings: 'tnum'`).
   - This ensures zero horizontal jitter and pixel-perfect vertical column alignment across rows.

4. **Strict Read-Only Boundary for Students (V1):**
   - The student portal in V1 is strictly a **verified placement dossier and drive noticeboard**.
   - No ad-hoc application buttons or self-uploaded unverified documents in V1. Shortlists are curated and managed by the TPO office via official registrar CSV records.

---

## 2. Definitive Color System & Tokens

### 2.1 Color Matrix Table

| Design Token | Hex Code | Tailwind Equivalent / Class | Usage Context |
|---|---|---|---|
| `primary` | `#111827` | `text-gray-900` / `bg-gray-900` | Primary headings, table text, dark buttons |
| `primary-container` | `#111827` | `bg-[#111827]` | Left navigation sidebar background |
| `secondary` | `#FECC00` | `bg-[#FECC00]` | Official DKTE Yellow: Primary CTAs, active pills |
| `on-secondary` | `#111827` | `text-[#111827]` | High-contrast dark text over DKTE Yellow |
| `surface` | `#FFFFFF` | `bg-white` | Card bodies, data tables, modals, inputs |
| `surface-canvas` | `#F8FAFC` | `bg-slate-50` / `bg-[#f8fafc]` | Canvas background for main workspace |
| `surface-dim` | `#F1F5F9` | `bg-slate-100` | Subdued containers, facility unavailable cells |
| `outline` | `#E5E7EB` | `border-gray-200` / `border-[#e5e7eb]` | 1px hairline dividers and card borders |
| `text-muted` | `#4B5563` | `text-gray-600` | Secondary metadata, captions, subtitles |
| `text-subtle` | `#6B7280` | `text-gray-500` | Footnotes, sync timestamps, breadcrumb links |

### 2.2 Recruitment Compensation Tiers

| Tier Name | CTC Bracket | Background | Text Color | Visual Specification |
|---|---|---|---|---|
| **Super Dream** | $\ge \text{₹10.00 LPA}$ | `#FECC00` | `#111827` | `bg-[#FECC00] text-[#111827] font-semibold px-2 py-0.5 rounded text-[11px]` |
| **Dream** | $\text{₹6.00 – ₹9.99 LPA}$ | `#DBEAFE` | `#1E40AF` | `bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded text-[11px]` |
| **Regular** | $< \text{₹6.00 LPA}$ | `#F3F4F6` | `#374151` | `bg-gray-100 text-gray-700 font-semibold px-2 py-0.5 rounded text-[11px]` |

### 2.3 Semantic Status & Stage Badges

| State / Stage | Background | Text Color | Icon / Indicator | Tailwind Classes |
|---|---|---|---|---|
| **Offers Released / Concluded** | `#DCFCE7` | `#15803D` | Emerald Dot (`#16a34a`) | `bg-green-100 text-green-800 rounded-full px-2.5 py-0.5 text-xs font-medium` |
| **Registration Closes (<48h)** | `#FEF3C7` | `#92400E` | Amber Dot (`#ea580c`) | `bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 text-xs font-medium` |
| **Round 2: Technical Interview** | `#DBEAFE` | `#1E40AF` | Cobalt Dot (`#2563eb`) | `bg-blue-100 text-blue-800 rounded-full px-2.5 py-0.5 text-xs font-medium` |
| **Online Assessment** | `#DBEAFE` | `#1E40AF` | Cobalt Dot (`#2563eb`) | `bg-blue-100 text-blue-800 rounded-full px-2.5 py-0.5 text-xs font-medium` |
| **Pre-Placement Talk** | `#F1F5F9` | `#475569` | Slate Dot (`#64748b`) | `bg-slate-100 text-slate-700 rounded-full px-2.5 py-0.5 text-xs font-medium` |

---

## 3. Typography Scale & Geometry

### 3.1 Typeface Specification
- **Primary Font:** `Inter`, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- **Numeric Figures:** Always apply `tabular-nums` to ensure exact column alignment.

| Scale Token | Font Size | Line Height | Weight | Letter Spacing | Usage |
|---|---|---|---|---|---|
| `display` | 32px (2.0rem) | 40px | 700 (Bold) | `-0.03em` | Hero metrics |
| `headline-lg` | 24px (1.5rem) | 32px | 700 (Bold) | `-0.02em` | Main page titles (`Recruitment Drives`) |
| `headline-md` | 20px (1.25rem) | 28px | 600 (Semibold) | `-0.015em` | Modal titles, major section headers |
| `headline-sm` | 16px (1.0rem) | 24px | 600 (Semibold) | `-0.01em` | Card titles (`Lab & Facility Allocation`) |
| `body-md` | 14px (0.875rem) | 20px | 400 / 500 | Normal | Primary table content, form labels |
| `body-sm` | 13px (0.8125rem)| 18px | 400 / 500 | Normal | Secondary table details, venue labels |
| `caption` | 11px (0.6875rem)| 14px | 600 (Semibold) | `+0.03em` | Tier badges, table column headers (`UPPERCASE`) |

### 3.2 Geometry Standards (`ROUND_FOUR`)
- **Base Corner Radius:** `rounded` (`4px` / `0.25rem`) for buttons, inputs, table cards, and filter dropdowns.
- **Medium Radius:** `rounded-md` (`6px` / `0.375rem`) for grouped segment controls.
- **Pill Radius:** `rounded-full` (`9999px`) for stage pills and status chips.
- **Borders:** `1px solid #E5E7EB` (`border border-gray-200`).
- **Elevation:** Flat 0-shadow layout. No heavy floating drop-shadows.

---

## 4. Complete 9-Page System Inventory & Navigation

```
                                  [ AUTH GATEWAY ]
                                     /login
                                        |
                 +----------------------+----------------------+
                 | (ROLE_TPO / ROLE_ADMIN)                     | (ROLE_STUDENT)
                 v                                             v
        [ TPO OPERATIONS CONSOLE ]                    [ STUDENT READ-ONLY PORTAL ]
        - /dashboard (Overview)                       - /portal/dossier (My Dossier)
        - /drives (Recruitment Drives)                - /portal/drives (Drives Noticeboard)
        - /companies (Company Directory)
        - /students (Student Directory)
        - /analytics (1-Click Reports)
        - /settings (Settings & CSV Ingest)
```

### 4.1 Route Inventory & Access Matrix

| Route | Page Title | Access Role | Primary Layout Shell | Purpose |
|---|---|---|---|---|
| `/login` | Institutional Sign-In | Public / All | Minimal Centered Card | PRN/Email authentication with role-based redirect |
| `/dashboard` | Overview / Dashboard | TPO Admin / Staff | Dark Left Sidebar (`w-64`) | Institutional KPIs, departmental distribution bars, quick roster |
| `/drives` | Recruitment Drives Console | TPO Admin / Staff | Dark Left Sidebar (`w-64`) | Active drive pipelines, applicant pools, lab terminal readiness matrix |
| `/companies` | Company Directory & CRM | TPO Admin / Staff | Dark Left Sidebar (`w-64`) | Historical recruiter database, hiring tiers, HR contacts |
| `/students` | Student Directory & Roster | TPO Admin / Staff | Dark Left Sidebar (`w-64`) | Full candidate search, CGPA & backlog filters, student dossier drawer |
| `/analytics` | Analytics & 1-Click Reports | TPO Admin / Staff | Dark Left Sidebar (`w-64`) | Accreditation data, NIRF CSV, Branch Matrix Excel, PDF generator |
| `/settings` | System Settings & CSV Ingest| TPO Admin / Staff | Dark Left Sidebar (`w-64`) | Master student CSV upload, AY rollover, policy configurations |
| `/portal/dossier`| My Placement Dossier | Student | Topbar Clean Canvas (`max-w-5xl`)| Verified academic credentials, offer details, placement status |
| `/portal/drives` | Drives Noticeboard | Student | Topbar Clean Canvas (`max-w-5xl`)| Eligible upcoming campus drives, assessment schedule, CCF venue |

---

## 5. Screen Blueprints & Detailed Component Anatomy

### 5.1 Page 3: Recruitment Drives & Facility Console (`/drives`)
*(Direct reference from the final approved console design)*

1. **Top Action Header Bar:**
   - Institutional breadcrumb: `DKTE Placement Console • Placement Season 2025–26`
   - Global Search: `Search candidate by PRN, name, or drive` (with leading search icon)
   - Academic Year Dropdown: `AY 2025–26`
   - Notification Bell with unread indicator dot
   - User profile avatar

2. **Page Title Row:**
   - Title: `Recruitment Drives` (`24px font-bold text-gray-900`)
   - Sync Indicator: `Synced 2m ago` pill with subdued gray dot
   - Subtitle: `Manage campus recruitment schedules, shortlists, and student application pipelines.`
   - Header Action Buttons:
     - Outlined Button: `[ Export Dossier ]` with download icon
     - Outlined Button: `[ Sync Exam Cell ]` with sync icon
     - **Primary Action CTA:** `[ + Post New Drive ]` (`bg-[#FECC00] text-[#111827] font-semibold hover:bg-[#e6b800] px-4 py-2 rounded shadow-none`)

3. **4-Column KPI Metric Strip:**
   - **Active Now:** `6` (Subtitle: `4 technical, 2 online tests`)
   - **This Week:** `12 Drives` (Subtitle: `Next: NVIDIA on 20 Nov`)
   - **Registrations Closing (<48h):** `2` (Subtitle: `NVIDIA, Capgemini`)
   - **Offers Pending Upload:** `48` (Subtitle: `Persistent LOIs awaiting TPO validation`)

4. **Filter & Drive Pipeline Tabs:**
   - Filter Tabs: `All Drives (28)` (with yellow active underline), `Ongoing & Shortlisting (8)`, `Upcoming Drives (12)`, `Completed Drives (8)`.
   - Control Bar: Search input (`Search by company, role, or drive ID..`), Branch dropdown (`Branch: All Departments`), Tier dropdown (`Tier: All Tiers`), Sort dropdown (`Sort: Drive Date (Asc)`).
   - View mode toggle: List view / Grid view icon buttons.

5. **Recruitment Drives Data Table:**
   - High-density columns:
     - Checkbox: `w-4 h-4 rounded border-gray-300`
     - **COMPANY & ROLE:** Company logo initial tile (`TCS`, `PS`, `NV`, `AC`, `GS`), Bold Company Name, Job Role, Eligible Branches.
     - **DRIVE DATE & VENUE:** Drive date (`12 Nov 2026 font-medium`), Venue badge (`DKTE CCF-1 Auditorium`).
     - **COMPENSATION & TIER:** CTC figure (`₹7.00 / ₹3.36 LPA tabular-nums`), Tier Pill (`Regular`, `Dream`, `Super Dream`).
     - **RECRUITMENT STAGE:** Stage pill with colored status dot (`Round 2: Technical Interview`, `Offers Released / Concluded`, `Registration Closes in 48h`, `Online Assessment`, `Pre-Placement Talk`).
     - **STUDENT POOL:** Headcount (`342 eligible`, `48 selects`, `184 applied`, `210 scheduled`).
     - **ACTIONS:** Contextual outline button (`Manage`, `View Offers`, `Screen Pool`, `Notify`, `Criteria`).

6. **Facility Allocation & Weekly Schedule Split Matrix (Bottom Row):**
   - **Left Card: Lab & Facility Allocation (480 Terminals Total)**
     - Terminal occupancy grid for CCF-1 (120 PCs), CCF-2 (80 PCs), Microprocessor Lab (60 PCs).
     - Color-coded bookings: TCS iON Test (Full Day - Blue), NVIDIA Coding (Orange), Available/Standby (Gray).
   - **Right Card: This Week's Schedule**
     - Timeline cards for upcoming interviews, online tests, and PPT sessions with exact cabin/lab locations.

---

### 5.2 Page 6: Analytics & 1-Click Institutional Reports (`/analytics`)

High-stakes reporting engine required for college governance and statutory accreditation bodies:

1. **NIRF Parameter File (.csv):**
   - Output conforming strictly to the National Institutional Ranking Framework format:
   - Graduating batch size, verified placed count, median CTC, students opting for higher studies.
2. **Branch-wise Performance Matrix (.xlsx):**
   - Cross-tabulated report across CSE, CSE-AIML, AIDS, ENTC, Mechanical, Electrical, Textile, and Civil.
   - Total eligible, total placed, placement %, average CTC, highest CTC, and gender breakdown.
3. **Placed Candidates Master Register (.xlsx):**
   - Comprehensive audit roster: Student PRN, Full Name, Branch, CGPA, Company Name, Offer Letter Number, Date of Offer, Base CTC, Tier Classification.
4. **Executive Recruiter Summary (.pdf):**
   - 1-click printable PDF summary of DKTE placement metrics for distribution to corporate visitors.

---

## 6. Ready-to-Use Tailwind Configuration Snippet

Add this configuration into `frontend/tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: '#FECC00',        // Official DKTE Brand Yellow
          yellowHover: '#E5B800',
          dark: '#111827',          // Near-Black
          sidebar: '#111827',
          canvas: '#F8FAFC',
        },
        tier: {
          regular: {
            bg: '#F3F4F6',
            text: '#374151',
          },
          dream: {
            bg: '#DBEAFE',
            text: '#1E40AF',
          },
          superDream: {
            bg: '#FECC00',
            text: '#111827',
          },
        },
        status: {
          successBg: '#DCFCE7',
          successText: '#15803D',
          warningBg: '#FEF3C7',
          warningText: '#92400E',
          infoBg: '#DBEAFE',
          infoText: '#1E40AF',
          neutralBg: '#F1F5F9',
          neutralText: '#475569',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',  // 4px ROUND_FOUR standard
        sm: '0.125rem',      // 2px
        md: '0.375rem',      // 6px
        lg: '0.5rem',        // 8px
        xl: '0.75rem',       // 12px
        full: '9999px',
      },
      boxShadow: {
        none: 'none',
        hairline: '0 0 0 1px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
}
```

---

## 7. Frontend Developer PR Checklist

Before submitting a Pull Request for any frontend component:
- [ ] **DKTE Yellow Budget:** Used only for primary CTAs, active indicators, and Super Dream badges.
- [ ] **Text Contrast:** Text on yellow background is strictly `#111827` (no light text, no yellow text on light background).
- [ ] **Tabular Numerals:** All currency (`₹XX.XX LPA`), dates, and numerical metrics have `tabular-nums` applied.
- [ ] **Hairline Borders:** Elements use `border border-gray-200` (`#E5E7EB`) without excessive drop shadows.
- [ ] **Corner Radius:** Standard components use `rounded` (4px). Status pills use `rounded-full`.
- [ ] **Responsive Fallback:** Tables maintain horizontal scroll containers on smaller screens without overflowing the viewport.
- [ ] **No Direct Push to Main:** Work is created on a dedicated feature branch and submitted via Pull Request.
