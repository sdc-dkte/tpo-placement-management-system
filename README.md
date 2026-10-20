# TPO Placement Management System

A web-based Placement Management System designed to help the Training and Placement Office (TPO) manage student academic records, companies, job roles, placement drives, eligibility, selection processes, and placement reports.

## Project Structure

```text
TPO-Placement-System/
├── backend/       # Node.js, Express, Prisma and PostgreSQL
├── frontend/      # React and Vite
├── .gitignore
└── README.md
```

## Technology Stack

### Backend
- Node.js
- Express.js
- PostgreSQL
- Prisma ORM
- REST API

### Frontend
- React
- Vite
- JavaScript
- CSS

## Main Modules

- Authentication and role-based authorization
- Student management and academic data import
- Company and job role management
- Placement drive management
- Student eligibility checking
- Participation and selection management
- Placement records
- Dashboard and analytics
- Reports and exports
- Student documents and portal
- Email campaigns

*Module availability depends on the current implementation status.*

## Prerequisites

Install the following before running the project:

- Node.js and npm
- PostgreSQL
- Git

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/sdc-dkte/tpo-placement-management-system.git
cd tpo-placement-management-system
```

### 2. Set up the backend

```bash
cd backend
npm install
```

Create your local `.env` file using `.env.example` as a reference. Configure your PostgreSQL connection and other required environment variables.

Run the database migrations using the command configured for this project, then start the backend using the script defined in `backend/package.json`.

### 3. Set up the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite in your terminal.

## Environment Variables

Keep credentials and secrets in your local `.env` file. Never commit actual database passwords, JWT secrets, API keys, or other sensitive values to GitHub.

## Development Status

The project is under active development. Features and workflows may change as backend and frontend integration progresses.

## Contributors

Developed as a college project for placement process management.

## License

License information will be added if and when a project license is selected.
