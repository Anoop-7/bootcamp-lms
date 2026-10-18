# REST API Specifications

All API responses follow a uniform, JSend-compliant envelope structure:

```json
{
  "status": "success" | "error",
  "data": { ... },
  "message": "Descriptive human-readable error string"
}
```

---

## 1. System Health

### GET /health
* **Access:** Public
* **Purpose:** Heartbeat probe verifying HTTP server runtime and Neon PostgreSQL pool connectivity.
* **Success Response (200 OK):**
```json
{
  "status": "ok",
  "db": "connected",
  "timestamp": "2026-10-18T16:00:00.000Z"
}
```

---

## 2. Authentication, Account Management & Password Recovery

### POST /api/v1/auth/register
* **Access:** Public
* **Payload Fields:**
  * `name` (string, required): Full display name.
  * `email` (string, required): Unique email address.
  * `password` (string, required): Plaintext password to be salted and hashed with bcrypt.
  * `role` (string, optional): One of `STUDENT`, `INSTRUCTOR`, `ADMIN`. Defaults to `STUDENT`.
* **Success Response (201 Created):**
```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "7d0c58ce-6377-484c-acce-e57100f44719",
      "email": "student@example.com",
      "name": "Test Student",
      "role": "STUDENT"
    }
  }
}
```
* **Error Response (409 Conflict):**
```json
{
  "status": "error",
  "message": "Email is already registered"
}
```

---

### POST /api/v1/auth/login
* **Access:** Public
* **Payload Fields:**
  * `email` (string, required): Account email.
  * `password` (string, required): Plaintext password.
* **Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "7d0c58ce-6377-484c-acce-e57100f44719",
      "email": "student@example.com",
      "name": "Test Student",
      "role": "STUDENT"
    }
  }
}
```
* **Error Response (401 Unauthorized):**
```json
{
  "status": "error",
  "message": "Invalid email or password"
}
```

---

### GET /api/v1/auth/me
* **Access:** Authenticated (Bearer Token required)
* **Headers:** `Authorization: Bearer <token>`
* **Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "id": "7d0c58ce-6377-484c-acce-e57100f44719",
    "email": "student@example.com",
    "name": "Test Student",
    "role": "STUDENT",
    "avatar": null,
    "createdAt": "2026-10-02T12:03:17.721Z",
    "updatedAt": "2026-10-18T12:03:17.721Z"
  }
}
```

---

### PUT /api/v1/auth/profile
* **Access:** Authenticated (Bearer Token required)
* **Headers:** `Authorization: Bearer <token>`
* **Payload Fields:**
  * `name` (string, optional): Updated display name.
* **Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "id": "7d0c58ce-6377-484c-acce-e57100f44719",
    "email": "student@example.com",
    "name": "Anoop N",
    "role": "STUDENT"
  }
}
```

---

### PUT /api/v1/auth/change-password
* **Access:** Authenticated (Bearer Token required)
* **Headers:** `Authorization: Bearer <token>`
* **Payload Fields:**
  * `currentPassword` (string, required): Existing plaintext password.
  * `newPassword` (string, required): New password (minimum 6 characters).
* **Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "Password changed successfully"
}
```
* **Error Response (400 Bad Request):**
```json
{
  "status": "error",
  "message": "Current password does not match"
}
```

---

### POST /api/v1/auth/forgot-password
* **Access:** Public
* **Payload Fields:**
  * `email` (string, required): Registered user email.
* **Behavior:** Generates a 6-digit cryptographic verification code with a 15-minute expiration window and stores the hashed code in `password_resets`.
* **Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "message": "Password reset OTP dispatched to your registered email address"
  }
}
```

---

### POST /api/v1/auth/reset-password
* **Access:** Public
* **Payload Fields:**
  * `email` (string, required): Registered email.
  * `otp` (string, required): 6-digit verification code.
  * `newPassword` (string, required): New password.
* **Behavior:** Verifies the OTP, invalidates the reset record, and updates the user's hashed password with bcrypt.
* **Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "Password has been reset successfully"
}
```
* **Error Response (400 Bad Request):**
```json
{
  "status": "error",
  "message": "Invalid or expired OTP verification code"
}
```

---

## 3. Platform Administration & Privileged Onboarding

### POST /api/v1/admin/invites
* **Access:** Restricted (`ADMIN` only)
* **Headers:** `Authorization: Bearer <token>`
* **Payload Fields:**
  * `email` (string, required): Candidate email.
  * `role` (enum, required): `INSTRUCTOR` or `ADMIN`.
* **Behavior:** Creates an onboarding invitation token valid for 48 hours.
* **Success Response (201 Created):**
```json
{
  "status": "success",
  "data": {
    "id": "invite-uuid-string",
    "email": "lead.instructor@bootcamp.dev",
    "role": "INSTRUCTOR",
    "token": "d748f92b...",
    "status": "PENDING",
    "expiresAt": "2026-10-20T14:00:00.000Z",
    "inviteUrl": "http://localhost:5173/onboard?token=d748f92b..."
  }
}
```

---

### GET /api/v1/admin/invites
* **Access:** Restricted (`ADMIN` only)
* **Headers:** `Authorization: Bearer <token>`
* **Purpose:** Retrieves the privileged invitation ledger tracking status, token states, and expiration dates.
* **Success Response (200 OK):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "invite-uuid-string",
      "email": "lead.instructor@bootcamp.dev",
      "role": "INSTRUCTOR",
      "status": "PENDING",
      "expiresAt": "2026-10-20T14:00:00.000Z",
      "createdAt": "2026-10-18T14:00:00.000Z"
    }
  ]
}
```

---

### POST /api/v1/admin/onboard
* **Access:** Public (Guarded by valid invite token)
* **Payload Fields:**
  * `token` (string, required): Onboarding token from invitation link.
  * `name` (string, required): Candidate display name.
  * `password` (string, required): Secure password.
* **Behavior:** Atomically creates the privileged account, marks the invitation as `ACCEPTED`, and signs a JWT session.
* **Success Response (201 Created):**
```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "user-uuid-string",
      "name": "Lead Instructor",
      "email": "lead.instructor@bootcamp.dev",
      "role": "INSTRUCTOR"
    }
  }
}
```

---

## 4. Cohorts & Catalog Discovery

### GET /api/v1/cohorts
* **Access:** Public / Optional Authenticated
* **Purpose:** Public catalog discovery. Lists published cohorts with internal meeting links and private curriculum folders omitted.
* **Success Response (200 OK):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "cohort-uuid-string",
      "title": "Production Distributed Systems",
      "slug": "production-distributed-systems",
      "description": "Master high-throughput backends, Raft consensus, and event streaming.",
      "thumbnail": null,
      "price": 7999,
      "status": "ONGOING_LIVE",
      "startDate": "2026-11-01T00:00:00.000Z",
      "endDate": null,
      "isLiveActive": false,
      "createdAt": "2026-10-03T12:45:00.000Z"
    }
  ]
}
```

---

### GET /api/v1/cohorts/instructor/me
* **Access:** Restricted (`INSTRUCTOR`, `ADMIN`)
* **Headers:** `Authorization: Bearer <token>`
* **Purpose:** Retrieves all cohorts managed by the authenticated instructor (Admins receive platform-wide listings).
* **Success Response (200 OK):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "cohort-uuid-string",
      "title": "Production Distributed Systems",
      "slug": "production-distributed-systems",
      "price": 7999,
      "status": "ONGOING_LIVE",
      "isLiveActive": true,
      "currentLiveUrl": "[https://zoom.us/j/9876543210](https://zoom.us/j/9876543210)"
    }
  ]
}
```

---

### GET /api/v1/cohorts/:slug
* **Access:** Public / Optional Authenticated
* **Behavior:** Non-enrolled users receive metadata only; enrolled students receive their active enrollment status and folder hierarchies.
* **Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "id": "cohort-uuid-string",
    "title": "Production Distributed Systems",
    "slug": "production-distributed-systems",
    "description": "Master high-throughput backends...",
    "price": 7999,
    "status": "ONGOING_LIVE",
    "isEnrolled": true,
    "isLiveActive": false,
    "folders": []
  }
}
```

---

### POST /api/v1/cohorts
* **Access:** Restricted (`INSTRUCTOR`, `ADMIN`)
* **Headers:** `Authorization: Bearer <token>`
* **Payload Fields:**
  * `title` (string, required): Unique cohort title.
  * `slug` (string, required): URL slug.
  * `description` (string, required): Course summary.
  * `price` (number, optional): Price in INR. Defaults to 0.
* **Success Response (201 Created):**
```json
{
  "status": "success",
  "data": {
    "id": "cohort-uuid-string",
    "title": "Production Distributed Systems",
    "slug": "production-distributed-systems",
    "price": 7999,
    "status": "UPCOMING_LIVE",
    "instructorId": "user-uuid-string",
    "isLiveActive": false
  }
}
```

---

## 5. Live Broadcasting & Attendance Auditing

### POST /api/v1/cohorts/:id/start-live
* **Access:** Restricted (`INSTRUCTOR`, `ADMIN`)
* **Headers:** `Authorization: Bearer <token>`
* **Payload Fields:**
  * `zoomUrl` (string, required): Active video stream/meeting URL (Zoom, Meet, etc.).
* **Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "id": "cohort-uuid-string",
    "isLiveActive": true,
    "currentLiveUrl": "[https://us02web.zoom.us/j/9876543210](https://us02web.zoom.us/j/9876543210)"
  }
}
```

---

### POST /api/v1/cohorts/:id/end-live
* **Access:** Restricted (`INSTRUCTOR`, `ADMIN`)
* **Headers:** `Authorization: Bearer <token>`
* **Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "id": "cohort-uuid-string",
    "isLiveActive": false,
    "currentLiveUrl": null
  }
}
```

---

### GET /api/v1/cohorts/:id/join-live
* **Access:** Authenticated (`STUDENT` enrolled in cohort, `INSTRUCTOR`, or `ADMIN`)
* **Headers:** `Authorization: Bearer <token>`
* **Behavior:** Validates cohort enrollment, registers an entry in `live_attendances` for student tracking, and securely returns the third-party meeting URL.
* **Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "meetingUrl": "[https://us02web.zoom.us/j/9876543210](https://us02web.zoom.us/j/9876543210)"
  }
}
```
* **Error Response (400 Bad Request):**
```json
{
  "status": "error",
  "message": "There is no live session in progress for this cohort right now."
}
```
* **Error Response (403 Forbidden):**
```json
{
  "status": "error",
  "message": "You are not enrolled in this cohort."
}
```

---

### GET /api/v1/cohorts/:id/attendance
* **Access:** Restricted (`INSTRUCTOR`, `ADMIN`)
* **Headers:** `Authorization: Bearer <token>`
* **Purpose:** Returns the chronological audit log of enrolled students who accessed live sessions for the cohort.
* **Success Response (200 OK):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "attendance-uuid-string",
      "userId": "user-uuid-string",
      "cohortId": "cohort-uuid-string",
      "joinedAt": "2026-10-18T15:30:00.000Z",
      "user": {
        "id": "user-uuid-string",
        "name": "Test Student",
        "email": "student@example.com"
      }
    }
  ]
}
```

---

## 6. Curriculum & AWS S3 Secure Media Delivery

### POST /api/v1/cohorts/:cohortId/folders
* **Access:** Restricted (`INSTRUCTOR`, `ADMIN`)
* **Headers:** `Authorization: Bearer <token>`
* **Payload Fields:**
  * `title` (string, required): Title of module.
  * `order` (number, optional): Sort order.
* **Success Response (201 Created):**
```json
{
  "status": "success",
  "data": {
    "id": "folder-uuid-string",
    "title": "Module 1: Distributed Storage",
    "order": 1,
    "cohortId": "cohort-uuid-string"
  }
}
```

---

### POST /api/v1/folders/:folderId/contents
* **Access:** Restricted (`INSTRUCTOR`, `ADMIN`)
* **Headers:** `Authorization: Bearer <token>`
* **Payload Fields:**
  * `title` (string, required): Lesson title.
  * `type` (enum, required): `RECORDING`, `OFFLINE_VIDEO`, `SLIDES`, or `DOCUMENT`.
  * `videoUrl` (string, optional): S3 object key or external stream link.
  * `resourceDoc` (string, optional): External document URL or S3 key.
  * `durationSec` (number, optional): Duration in seconds.
* **Success Response (201 Created):**
```json
{
  "status": "success",
  "data": {
    "id": "content-uuid-string",
    "title": "Lecture 1: Consensus with Raft",
    "type": "RECORDING",
    "folderId": "folder-uuid-string",
    "videoUrl": "lectures/raft-consensus.mp4",
    "durationSec": 4800,
    "order": 1
  }
}
```

---

### GET /api/v1/contents/:id/access-url
* **Access:** Authenticated (Enrolled `STUDENT`, `INSTRUCTOR`, or `ADMIN`)
* **Headers:** `Authorization: Bearer <token>`
* **Behavior:** Validates student enrollment and generates a short-lived (900s / 15 min) AWS S3 pre-signed `GetObject` URL.
* **Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "url": "[https://bootcamp-lms-assets-anoop.s3.ap-south-1.amazonaws.com/lectures/raft-consensus.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=](https://bootcamp-lms-assets-anoop.s3.ap-south-1.amazonaws.com/lectures/raft-consensus.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=)...",
    "isDirect": false
  }
}
```

---

## 7. Progress Tracking & Playback State

### GET /api/v1/cohorts/:cohortId/progress
* **Access:** Authenticated (`STUDENT`)
* **Headers:** `Authorization: Bearer <token>`
* **Purpose:** Fetches playback watch time and completion status for all lessons in the cohort.
* **Success Response (200 OK):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "progress-uuid-string",
      "contentId": "content-uuid-string",
      "watchedSeconds": 3120,
      "isCompleted": false
    }
  ]
}
```

---

### POST /api/v1/contents/:contentId/progress
* **Access:** Authenticated (`STUDENT`)
* **Headers:** `Authorization: Bearer <token>`
* **Payload Fields:**
  * `watchedSeconds` (number, required): Current playback timestamp in seconds.
  * `isCompleted` (boolean, optional): Explicit completion override.
* **Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "contentId": "content-uuid-string",
    "watchedSeconds": 3120,
    "isCompleted": false
  }
}
```

---

## 8. Enrollment Lifecycle

### POST /api/v1/cohorts/:cohortId/enroll
* **Access:** Authenticated (`STUDENT`)
* **Headers:** `Authorization: Bearer <token>`
* **Behavior:** Provisions the user's cohort enrollment record. Rejects duplicate enrollment attempts.
* **Success Response (201 Created):**
```json
{
  "status": "success",
  "data": {
    "enrollment": {
      "id": "enrollment-uuid",
      "userId": "user-uuid",
      "cohortId": "cohort-uuid",
      "enrolledAt": "2026-10-18T10:00:00.000Z"
    }
  }
}
```

---

### GET /api/v1/enrollments/my
* **Access:** Authenticated (`STUDENT`)
* **Headers:** `Authorization: Bearer <token>`
* **Purpose:** Retrieves all active cohort enrollments for the student dashboard.
* **Success Response (200 OK):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "enrollment-uuid",
      "cohortId": "cohort-uuid",
      "enrolledAt": "2026-10-18T10:00:00.000Z",
      "cohort": {
        "id": "cohort-uuid",
        "title": "Production Distributed Systems",
        "slug": "production-distributed-systems",
        "isLiveActive": true
      }
    }
  ]
}
```