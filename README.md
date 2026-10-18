# Bootcamp 1.0 — Enterprise Cohort-Based LMS Engine

> A production-grade learning management platform engine built with Node.js, Express, TypeScript, PostgreSQL (Neon), and AWS S3. Built around developer cohort workflows—featuring live session orchestration, gated curricula, secure pre-signed video pipelines, role-based access control, and an administrative onboarding ledger.

---

## 🤖 Development Process

This project was built adopting modern **AI-assisted engineering workflows**. 

* **Human-Led Architecture:** All architectural decisions—including domain modeling (Prisma), the Controller-Service-Repository pattern, S3 presigned security constraints, and RBAC policies—were directed and verified manually.
* **Accelerated Delivery:** AI tooling was utilized as an intelligent thought partner for rapid scaffolding, documentation generation, and accelerating repetitive boilerplate.
* **Rigorous Verification:** Every endpoint, database migration, and frontend UX flow underwent manual integration testing and edge-case audits.

---

## 🏗 Repository Layout

```text
Bootcamp 1.0/
├── backend/            # Express 5, Prisma ORM, Neon PostgreSQL adapter, AWS S3 SDK
│   ├── prisma/         # Relational schema migrations and database configurations
│   ├── src/
│   │   ├── controllers/# HTTP transport orchestration & input sanitation
│   │   ├── middlewares/# JWT authentication, RBAC authorization, rate limiting
│   │   ├── repositories/# Prisma data access & query abstractions
│   │   ├── routes/     # Clean Express v5 API routes
│   │   ├── services/   # Business logic, S3 pre-signing, OTP & token generation
│   │   ├── workers/    # Background video ingestion & processing routines
│   │   ├── app.ts      # Express application setup & middleware assembly
│   │   └── server.ts   # HTTP listener bootstrap & graceful shutdown hooks
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/           # React 19, Vite, Tailwind CSS v4, TanStack Query
│   ├── src/
│   │   ├── components/ # VideoPlayer, Navbar, ProtectedRoute, PublicRoute
│   │   ├── context/    # Global authentication & token context provider
│   │   ├── lib/        # Axios API client with automatic bearer interceptors
│   │   ├── pages/      # Dashboard, CoursePlayer, InstructorHub, AdminDashboard, JoinLive
│   │   ├── App.tsx     # Client-side router and role-based guards
│   │   └── main.tsx    # React root entry point
│   ├── package.json
│   └── vite.config.ts
├── docs/               # Technical specifications & system architecture
│   ├── architecture.md # Design patterns, data pipelines, and security mechanisms
│   └── api-specs.md    # REST API endpoints, schemas, and status codes
└── README.md           # Engineering overview & local setup guide
```

---

## ⚡ Tech Stack & Core Infrastructure

### Backend
* **Runtime:** Node.js (NodeNext ESM)
* **Language:** TypeScript 5+ (Strict)
* **Framework:** Express 5 (Native asynchronous error propagation)
* **ORM:** Prisma 7 with `@prisma/adapter-pg`
* **Database:** PostgreSQL (Neon Serverless with pooled connection endpoints)
* **Storage:** AWS S3 (`ap-south-1`) for private media storage and short-lived pre-signed URLs
* **Security:** JWT (Stateless authentication) & Bcrypt (Password hashing)

### Frontend
* **UI Framework:** React 19 (TypeScript)
* **Tooling:** Vite
* **Styling:** Tailwind CSS v4
* **State & Data Fetching:** TanStack React Query (v5)
* **Icons:** Lucide React

---

## 🚀 Key Platform Features

1. **Role-Based Navigation & Access Control:**
   * Automated post-login redirection based on user role (`/admin` for Admins, `/instructor` for Instructors, `/dashboard` for Students).
   * Minimalist header navigation with user profile menu and role-aware workspace shortcuts.

2. **Privileged Onboarding System:**
   * Administrative invitation ledger generating signed, time-limited tokens (48-hour expiration) for onboarding new instructors.
   * Eliminates open instructor registrations while avoiding manual database seeding.

3. **Secure Video Delivery Pipeline:**
   * Direct media streaming from private AWS S3 storage via short-lived pre-signed URLs (15-minute expiration).
   * Verifies enrollment before generating streaming signatures, keeping video delivery independent of application server compute.

4. **Live Class Gateway & Attendance Auditing:**
   * Instructors launch live broadcast sessions (Zoom, Google Meet, etc.) directly from the Instructor Hub.
   * Active live sessions display a pulsing notification banner across enrolled students' course dashboards.
   * The `/cohorts/:id/join-live` gateway verifies enrollment, records an entry in `live_attendances`, and opens the meeting in a new tab.

5. **Self-Service Authentication Workflows:**
   * Complete password reset flow utilizing 6-digit numeric OTPs with 15-minute expiration windows.
   * In-app user profile updates and credential changes.

6. **Interactive Course Player:**
   * Cinema-mode video player with progress tracking, module accordions, lesson search, and playback position memory.

---

## 📐 System Architecture Overview

The backend strictly implements the **Controller-Service-Repository (CSR)** pattern:

```text
[ Client / Browser ]
        │
  (HTTP Request)
        ▼
┌──────────────────────────────────────────────┐
│ Express Router                               │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ Middlewares (JWT Bearer Auth, RBAC Checks)   │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ Controllers (Payload extraction & DTOs)      │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ Services (Domain logic & S3 signing rules)   │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ Repositories (Prisma Client & SQL queries)   │
└──────┬───────────────────────────────────────┘
       │
       ▼
[ Neon PostgreSQL Pool ] & [ AWS S3 Asset Bucket ]
```

* Complete architectural decisions are documented in [`docs/architecture.md`](docs/architecture.md).
* Complete API schemas and status codes are documented in [`docs/api-specs.md`](docs/api-specs.md).

---

## 🛠 Getting Started

### 1. Prerequisites
* **Node.js** >= 20.x
* **npm** >= 10.x
* A **Neon PostgreSQL** database instance
* An **AWS S3** bucket with programmatic IAM credentials

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Configure `.env`:
   ```env
   PORT=5000
   DATABASE_URL="postgresql://<user>:<password>@<neon-pooler-endpoint>/neondb?sslmode=require"
   JWT_SECRET="your-ultra-secure-jwt-secret-string"

   # AWS S3 Storage
   AWS_REGION="ap-south-1"
   AWS_ACCESS_KEY_ID="AKIA..."
   AWS_SECRET_ACCESS_KEY="..."
   AWS_S3_BUCKET="bootcamp-lms-assets-anoop"
   ```
3. Install dependencies and synchronize schema:
   ```bash
   npm install
   npx prisma db push
   npx prisma generate
   ```
4. Start the backend development server:
   ```bash
   npm run dev
   ```

### 3. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Configure `.env`:
   ```env
   VITE_API_URL="http://localhost:5000/api/v1"
   ```
3. Install dependencies and start Vite:
   ```bash
   npm install
   npm run dev
   ```
4. Access the web client at `http://localhost:5173`.