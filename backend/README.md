# TPO Placement Management System — Backend

A backend application for the Training and Placement Office (TPO) to manage student records, companies, placement drives, eligibility, placement outcomes, and reporting.

**Organization:** [SDC DKTE](https://github.com/sdc-dkte)  
**Repository:** [tpo-placement-management-system](https://github.com/sdc-dkte/tpo-placement-management-system)  
**Project Status:** Initial backend setup and health-check API

## Overview

The TPO Placement Management System aims to centralize placement-related activities through a structured web application for TPO staff and students.

The backend provides the API layer, database access, authentication, business rules, and data management for the system.

## Technology Stack

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express.js | REST API framework |
| PostgreSQL | Relational database |
| Prisma ORM | Database access and schema management |
| JWT | Planned authentication |
| bcrypt | Planned password hashing |

## Current Features

- Express server setup
- Environment-based configuration
- PostgreSQL database connectivity through Prisma
- Health-check API
- Versioned API prefix: `/api/v1`
- Centralized handling of unknown routes and server errors

Additional modules will be implemented incrementally.

## Project Structure

```text
backend/
├── docs/                  # Project documentation
├── prisma/
│   ├── migrations/        # Database migration history
│   └── schema.prisma      # Database schema
├── src/
│   ├── controllers/       # Request handlers
│   ├── routes/            # API route definitions
│   ├── middleware/        # Express middleware
│   ├── utils/              # Shared utilities
│   ├── prismaClient.js    # Shared Prisma client
│   └── server.js          # Express application entry point
├── .env.example           # Environment variable template
├── .gitignore
├── package.json
├── package-lock.json
└── prisma.config.ts
```

Some directories may be expanded as development progresses.

## Prerequisites

Install the following before running the backend:

- Node.js and npm
- PostgreSQL
- Git

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/sdc-dkte/tpo-placement-management-system.git
cd tpo-placement-management-system
```

If you are cloning this repository into an existing project workspace, choose a suitable destination folder.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create your local `.env` file using `.env.example` as a template.

In PowerShell:

```powershell
Copy-Item .env.example .env
```

Update `.env` with your local PostgreSQL credentials and a strong, private JWT secret.

**Never commit `.env`, database passwords, JWT secrets, or API keys.**

### 4. Configure the database

Ensure PostgreSQL is running and that your database exists. Set `DATABASE_URL` in `.env` to the correct connection string.

Apply the existing migrations using:

```bash
npx prisma migrate deploy
```

For a local development database where new migrations need to be created, use the project's established Prisma migration workflow. Do not reset the database or delete existing migrations.

### 5. Start the development server

```bash
npm run dev
```

The default local address is:

```text
http://localhost:5000
```

## API Health Check

Check whether the backend and database are available:

**Endpoint:** `GET /api/v1/health`

```text
http://localhost:5000/api/v1/health
```

A successful response should indicate that the server is running and the database is connected.

## API Base URL

```text
http://localhost:5000/api/v1
```

All API modules should use this versioned prefix.

## Security

- Keep environment variables and secrets out of version control.
- Hash passwords before storing them.
- Validate incoming request data.
- Protect private routes using authentication and role-based authorization.
- Restrict CORS to approved frontend origins.
- Avoid returning internal error details to API clients.

## Development Workflow

1. Create a feature branch for your assigned module.
2. Implement the feature using the agreed API contract and Prisma schema.
3. Test the endpoint and database behavior.
4. Commit changes with a meaningful message.
5. Push the branch and open a pull request for review.
6. Merge only after the changes have been reviewed and tested.

Do not modify shared database models or migrations without coordinating with the project lead.

## Contributing

This repository is maintained as part of the SDC DKTE project. Team members should coordinate their module ownership, API contracts, database changes, and pull requests before merging changes.

## License

No license has been selected yet. Repository usage and redistribution terms should be decided by the project maintainers.
