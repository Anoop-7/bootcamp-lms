# Architecture & Technical Design

This document details the software design patterns, end-to-end data pipelines, security mechanisms, and runtime infrastructure governing the Bootcamp LMS platform.

---

## 1. Architectural Pattern: Controller-Service-Repository (CSR)

The backend isolates transport handling, business validation, and data persistence into three decoupled tiers:

```text
[ HTTP Request ]
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ Express Router & Middlewares (Auth / RBAC / Limiter)   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Controller Layer (src/controllers/)                    │
│ - Extracts params, query strings, and request bodies   │
│ - Formats HTTP response codes and JSend envelopes      │
│ - Contains no Prisma queries or database models        │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Service Layer (src/services/)                          │
│ - Domain business logic & authorization evaluations    │
│ - AWS S3 Pre-signed URL generation                     │
│ - Bcrypt password hashing & JWT token issuance         │
│ - Agnostic of Express req/res primitives               │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Repository Layer (src/repositories/)                   │
│ - Executes database queries through Prisma ORM Client  │
│ - Manages joins, relational inclusions, and aggregates │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
              [ Neon PostgreSQL Pooler ]
```

### Layer Responsibilities
* **Controllers (`src/controllers/`):** Transport boundaries that parse payloads, invoke domain services, and translate service outputs into standard JSON envelopes.
* **Services (`src/services/`):** Core business logic layer. Handles permissions, generates pre-signed S3 links, hashes credentials, and coordinates transactions.
* **Repositories (`src/repositories/`):** Data access abstraction providing strongly typed database queries via Prisma.
* **Workers (`src/workers/`):** Asynchronous processing routines (`videoWorker.ts`) dedicated to background media transcoding, asset parsing, and external ingestion pipelines.

---

## 2. Security Architecture & Identity Management

### 2.1 Role-Based Access Control (RBAC) & Dynamic Routing
The system enforces a 3-tier permission hierarchy:
* **`STUDENT`:** Explores public cohorts, enrolls in courses, accesses pre-signed media streams, logs watch progress, and enters live sessions.
* **`INSTRUCTOR`:** Manages owned cohorts, builds curriculum hierarchies (folders and content items), starts/stops live meetings, and inspects real-time attendance logs.
* **`ADMIN`:** Holds global system authority, generates privileged onboarding invitations via the admin ledger (`/admin`), and inspects platform-wide cohorts and users.

### 2.2 Client-Side Route Separation & Redirection
Authenticated sessions undergo client-side routing based on role:
* **`ADMIN`** $\rightarrow$ Automatically routed to `/admin` (`AdminDashboard.tsx`).
* **`INSTRUCTOR`** $\rightarrow$ Automatically routed to `/instructor` (`InstructorHub.tsx`).
* **`STUDENT`** $\rightarrow$ Automatically routed to `/dashboard` (`Dashboard.tsx`).
* Public landing pages and authentication forms are protected by `PublicRoute.tsx` to prevent logged-in users from viewing redundant sign-in screens.

### 2.3 Privileged Admin Onboarding Ledger
To eliminate open instructor sign-ups while preventing manual database modifications:
1. An admin generates an onboarding invitation via `POST /api/v1/admin/invites`.
2. The system hashes a cryptographically secure 48-hour token and logs the record in the invitation ledger.
3. The prospective instructor accesses `http://localhost:5173/onboard?token=...`, verifying the token against the database before provisioning their privileged account.

### 2.4 Self-Service Password Recovery
1. The user requests a password reset from the login view.
2. The backend generates a 6-digit numeric OTP with a 15-minute expiration window and stores its hash in `password_resets`.
3. The user submits the OTP with their new password to `POST /api/v1/auth/reset-password`.
4. The system validates the OTP, salts and hashes the new password with bcrypt, and purges the reset token.

### 2.5 Dual-Token Session Architecture & Silent Rotation
To prevent disruptive session timeouts while protecting authentication secrets:
1. **Short-Lived Access Token (15 Minutes):** Passed in the `Authorization: Bearer <token>` header for stateless API route authentication and RBAC checks.
2. **Secure Refresh Token (7 Days):** Generated with a unique cryptographic `jti` and stored exclusively inside an `httpOnly`, `sameSite`, `secure` cookie (`refreshToken`), preventing access by client-side scripts.
3. **Transparent Frontend Refresh Interceptor:** The client Axios interceptor captures `401 Unauthorized` responses. If token renewal is already in progress, concurrent outgoing requests are enqueued in a thundering-herd queue (`failedQueue`). When the rotated token returns from `POST /api/v1/auth/refresh`, the queue resolves and retries all waiting requests transparently without forcing page reloads.
4. **Instant Revocation via `tokenVersion`:** Both access and refresh tokens embed the user's `tokenVersion`. Changing or resetting a password atomically increments `tokenVersion` in PostgreSQL, immediately invalidating all outstanding tokens across all user devices.

---

## 3. Media Delivery & AWS S3 Pre-signed Security

To protect course content and avoid routing high-bandwidth video streams through the Express server:

```text
Student Client            Express API               AWS S3 Edge
      │                        │                         │
      ├── 1. GET access-url ──►│                         │
      │   (Bearer Token)       │                         │
      │                        │                         │
      │                  2. Verify Active                │
      │                     Enrollment                   │
      │                        │                         │
      │                  3. Generate S3                  │
      │                     Presigned URL                │
      │                     (Valid 900s)                 │
      │                        │                         │
      │◄── 4. Return URL ──────┤                         │
      │                        │                         │
      ├── 5. Stream Video Chunks Directly ──────────────►│
      │◄── 6. Byte Stream Delivery (206 Partial Content)─┤
```

* **Private Bucket Policy:** Direct public reads on the S3 bucket are disabled.
* **Short-Lived Signatures:** Signatures expire in 900 seconds (15 minutes).
* **Direct Egress:** Video streams are served directly from AWS S3 edge locations, avoiding Express runtime bandwidth consumption.

---

## 4. Live Orchestration & Attendance Audit Gateway

To allow instructors to host live meetings (via Zoom, Google Meet, etc.) while tracking attendance and preventing open link leakage:

1. **Instructor Broadcast Trigger:** An instructor enters a meeting URL and clicks **"Start Broadcast"** in `InstructorHub.tsx`.
2. **Real-time Cohort Banner:** `cohort.isLiveActive` switches to `true`. Students viewing `/cohorts/:id/learn` receive an alert banner linking to `/cohorts/:id/join-live`.
3. **Gateway Enforcement (`JoinLive.tsx`):**
   * Verifies the user is authenticated. If not, redirects to login with return intent preserved.
   * Confirms active enrollment in the cohort.
   * Creates an audit entry in `live_attendances` with a timestamp.
   * Resolves the meeting link and launches it in a new browser tab.
4. **Attendance Audit Log:** Instructors view attendance counts and student timestamps directly inside the Instructor Hub.

---

## 5. High-Concurrency Database Pooling

Serverless databases (such as Neon PostgreSQL) auto-scale compute layers. Unpooled microservice connections can exhaust connection limits under burst traffic.

* The backend integrates `@prisma/adapter-pg` paired with a connection pool (`pg.Pool`).
* All application queries run through Neon’s pooled domain (`-pooler`), providing connection reuse and resilience against high-concurrency spikes.

---

## 6. Frontend Architecture & Playback Experience

* **Modern Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, and `@tanstack/react-query`.
* **State & Query Cache:** Server state is cached and automatically synchronized via TanStack Query invalidation (e.g., updating video progress or toggling live session status).
* **Custom Video Player (`VideoPlayer.tsx`):** Features automated playback position persistence (`localStorage`), speed modulation, keyboard shortcuts, and progress synchronization via `POST /api/v1/contents/:id/progress`.

---

## 7. Quality Gate & Automated Testing Architecture

The backend implements automated testing with **Vitest** (native ESM/TypeScript test runner) and **Supertest** (HTTP endpoint assertion):

```text
tests/
├── unit/
│   ├── auth.service.test.ts      # Token expiration, rotation, revocation & bcrypt checks
│   └── payment.service.test.ts   # Paise conversion, duplicate checks & HMAC SHA-256 verification
├── integration/
│   └── auth.routes.test.ts       # Supertest HTTP flows: cookie parsing, refresh rotation, logout
└── tsconfig.json                 # Dedicated test TypeScript configuration
```

### 7.1 Unit Testing Strategy
* **Auth Service (`auth.service.test.ts`):** Validates 15m access token and 7d refresh token lifespans, payload decodes (`userId`, `role`, `tokenVersion`, `jti`), token rotation mechanics, signature tampering rejection, and `tokenVersion` session revocation.
* **Payment Service (`payment.service.test.ts`):** Validates order calculation (rupees to paise), rejects duplicate orders for already enrolled students, rejects free cohort checkout, verifies genuine Razorpay HMAC SHA-256 signatures via `crypto.timingSafeEqual`, and rejects forged signatures.

### 7.2 Integration Testing Strategy
* **Auth Routes (`auth.routes.test.ts`):** Tests Express transport and cookie parsing via Supertest:
  * Rejects missing refresh cookies with `401 Unauthorized`.
  * Clears invalid cookies with expired `Set-Cookie` directives.
  * Validates token rotation and verifies fresh `refreshToken` is set in the response `Set-Cookie` header.
  * Verifies `POST /auth/logout` clears the authentication cookie.