# Bootcamp Platform

A full-stack, cohort-based learning management and video streaming platform built with TypeScript, Node.js, Express 5, React 19, and PostgreSQL (via Prisma ORM). Engineered with strict security hardening, signed CloudFront HLS content delivery, server-evaluated progress tracking, and simulated payment checkout via Razorpay Test Mode.

---

## Technical Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS, TanStack Query, Lucide Icons |
| **Backend** | Node.js 20+, Express 5, TypeScript |
| **Database & ORM** | PostgreSQL (Neon / Local), Prisma ORM |
| **Video Streaming** | AWS S3 (Multipart Uploads), CloudFront (Signed Cookies, HLS Adaptive Bitrate) |
| **Payments** | Razorpay Gateway (Test Mode / Sandbox) |
| **Security & Quality**| JWT Auth, Bcrypt, Token Versioning, Helmet, Rate Limiting, ESLint, GitHub Actions CI |

---

## Core System Architecture & Features

### 1. Authentication & Session Integrity
- **Role-Based Access Control (RBAC):** Distinct workflows and access layers for `STUDENT`, `INSTRUCTOR`, and `ADMIN`.
- **Token Versioning (`tokenVersion`):** Centralized JWT session revocation. Changing or resetting passwords atomically increments the user's version counter, invalidating stale tokens across existing sessions.
- **Cryptographic OTP Flows:** 6-digit verification codes generated with CSPRNG (`crypto.randomInt`) with SHA-256 hash storage and strict expiration windows for registration and account recovery.
- **Invite-Only Instructor Onboarding:** Admins issue cryptographic, time-limited invitation tokens. Accounts are provisioned without public registration vectors or database seeding.

### 2. Video Pipeline & Secure HLS Streaming
- **S3 Multipart Upload Pipeline:** Instructors upload lecture videos directly in multi-part chunks via pre-signed S3 URLs, bypassing web-tier bottlenecking.
- **Path-Scoped CloudFront Signed Cookies:** Media traffic is delivered over AWS CloudFront. Access requests generate `CloudFront-Policy`, `CloudFront-Signature`, and `CloudFront-Key-Pair-Id` HTTP-only cookies restricted to the specific lecture HLS directory (`/hls/<asset-id>/*`) with a 2-hour TTL.
- **Adaptive Bitrate (ABR) Playback:** Custom HLS video player with auto-resolution switching, variable playback speeds, dynamic anti-piracy watermarking, and auto-resume.

### 3. Server-Side Heartbeat & Progress Evaluation
- **Anti-Tampering Watch Tracking:** Course completion cannot be claimed via client assertions. Monotonic watch progress updates via periodic heartbeats (`POST /contents/:id/heartbeat`).
- **Enrollment & Threshold Verification:** Completion markers (`isCompleted`) are strictly calculated on the server when validated watch time crosses 90% of duration, guarded by active session validation and cohort enrollment checks.

### 4. Commerce & Order Verification
- **Razorpay Test Mode Integration:** Built-in checkout flow supporting test cards, dummy Netbanking, and mock UPI handles.
- **Cryptographic Callback Verification:** Orders are generated on the server with amounts stored in paise. Client-side payment callbacks verify signatures using HMAC SHA-256 before committing atomic enrollment and order transitions.

---

## Architectural Pattern

The backend follows an explicit Controller-Service-Repository pattern:

```
                      ┌────────────────────────────┐
                      │    Incoming HTTP Request   │
                      └──────────────┬─────────────┘
                                     │
                 [ Helmet / CORS / RateLimiter / Auth JWT ]
                                     │
                                     ▼
                      ┌────────────────────────────┐
                      │        Controllers         │
                      │  (Input Validation & DTO)  │
                      └──────────────┬─────────────┘
                                     │
                                     ▼
                      ┌────────────────────────────┐
                      │          Services          │
                      │ (Business Rules & Signing) │
                      └──────┬──────────────┬──────┘
                             │              │
              ┌──────────────┘              └──────────────┐
              ▼                                            ▼
   ┌───────────────────────┐                    ┌───────────────────────┐
   │     Repositories      │                    │ External Integrations │
   │  (Prisma ORM Queries) │                    │ (S3 / CloudFront/ RZP)│
   └──────────┬────────────┘                    └───────────────────────┘
              ▼
   ┌───────────────────────┐
   │  PostgreSQL Database  │
   └───────────────────────┘
```

---

## Repository Structure

```
├── .github/
│   └── workflows/
│       └── ci.yml               # Automated TypeScript typecheck, ESLint, and build pipeline
├── backend/
│   ├── prisma/
│   │   └── schema.prisma        # Database models & relationships
│   ├── src/
│   │   ├── config/              # S3, CloudFront signer, database, and env validation
│   │   ├── controllers/         # HTTP request handlers
│   │   ├── middlewares/         # JWT auth, RBAC, error handler, rate limiters
│   │   ├── repositories/        # Database access layer
│   │   ├── routes/              # Route definitions
│   │   ├── services/            # Core business & payment verification logic
│   │   ├── app.ts               # Express application configuration
│   │   └── server.ts            # Entry point & graceful shutdown hooks
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/          # VideoPlayer, Navbar, protected route wrappers
│   │   ├── context/             # AuthContext with persistent session state
│   │   ├── lib/                 # Axios HTTP client configuration
│   │   ├── pages/               # CoursePlayer, CohortDetail, InstructorHub, AdminDashboard
│   │   └── utils/               # Multipart chunking & upload utilities
│   └── .env.example
├── LICENSE                      # MIT License
└── README.md
```

---

## Getting Started

### Prerequisites
- **Node.js**: v20.x or higher
- **PostgreSQL**: Local instance or hosted database (e.g., Neon)
- **AWS Account**: S3 bucket & CloudFront key pair (optional for local mock testing)
- **Razorpay Account**: API Test Key & Secret

---

### Backend Setup

1. **Navigate to the backend directory and install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Fill in the required configuration:
   ```env
   NODE_ENV=development
   PORT=5000
   DATABASE_URL="postgresql://user:password@localhost:5432/bootcamp?schema=public"
   JWT_SECRET="your-secure-32-char-random-jwt-secret"

   # S3 & CloudFront (HLS Streaming)
   AWS_REGION="ap-south-1"
   AWS_S3_BUCKET="your-s3-bucket"
   AWS_ACCESS_KEY_ID="your-access-key-id"
   AWS_SECRET_ACCESS_KEY="your-secret-access-key"
   CLOUDFRONT_DOMAIN="https://dxxxxxxxxxxxx.cloudfront.net"
   CLOUDFRONT_KEY_PAIR_ID="KXXXXXXXXXXXXX"
   CLOUDFRONT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"

   # Payments
   PAYMENTS_MODE=razorpay
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=your_razorpay_secret
   ```

3. **Initialize the database:**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

4. **Start the API server:**
   ```bash
   npm run dev
   ```
   The backend API will run on `http://localhost:5000`.

---

### Frontend Setup

1. **Navigate to the frontend directory and install dependencies:**
   ```bash
   cd ../frontend
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Ensure the API endpoint is configured:
   ```env
   VITE_API_BASE_URL=http://localhost:5000/api/v1
   ```

3. **Start the Vite development server:**
   ```bash
   npm run dev
   ```
   The client application will run on `http://localhost:5173`.

---

## Quality & Verification

The codebase runs strict typechecks and ESLint rules:

```bash
# In backend/
npx tsc --noEmit

# In frontend/
npm run lint
npm run build
```

Every push and pull request to `main` triggers `.github/workflows/ci.yml` to ensure no linting warnings, typing violations, or broken builds enter the mainline.

---

## License

This project is licensed under the [MIT License](LICENSE).