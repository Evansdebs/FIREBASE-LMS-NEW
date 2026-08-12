# FINAL COMPREHENSIVE MIGRATION PLAN: ONEREAL LMS Backend Migration to Supabase

> **CRITICAL MANDATE**: DO NOT START MIGRATION OR MODIFY PRODUCTION UNTIL EXPLICITLY APPROVED BY THE USER.
> **SAFETY GUARANTEE**: Render PostgreSQL database (`onereal-lms-db`), Render backend web service, and production authentication remain UNTOUCHED and active.

---

## 1. Production Database Source Specification

- **EXCLUSIVE PRODUCTION MIGRATION SOURCE**: The Render PostgreSQL database `onereal-lms-db` is the **ONLY** authoritative source for production data migration.
- **DEVELOPMENT-ONLY DISCLAIMER**: `backend/prisma/dev.db` is strictly development-only and **MUST NEVER** be used as the source for production data migration under any circumstances. SQLite is completely excluded from the production migration procedure.

---

## 2. Authentication Migration Method & Identity Linking

### Investigation Findings: Prisma User ID Architecture
- **`User.id`**: `Int` (`@id @default(autoincrement())`)
- **`Student.userId`**: `Int` (`@unique`, FK to `User.id`)
- **`Teacher.userId`**: `Int` (`@unique`, FK to `User.id`)
- **Foreign Keys Referencing `User.id`**:
  1. `Student.userId` (Int, 1-to-1)
  2. `Teacher.userId` (Int, 1-to-1)
  3. `Material.uploadedBy` (Int)
  4. `Simulation.uploadedBy` (Int)
  5. `MaterialProgress.studentId` (Int)
  6. `Note.userId` (Int)
  7. `Message.senderId` & `Message.receiverId` (Int)
  8. `Notification.userId` (Int?)
  9. `Achievement.userId` & `Achievement.studentId` (Int)
  10. `AuditLog.userId` (Int?)
  11. `ForumThread.authorId` & `ForumPost.authorId` (Int)
  12. `ShopItem.createdBy` & `ShopInterest.userId` (Int)
- **Application & API Contract**:
  - JWT Payload: `{ id: user.id, role: user.role }` where `id` is an `Int`.
  - Auth Middleware: `req.user` fetched using integer `id`.
  - Frontend Context: `user.id` is typed as `number`.

### Safe Identity Linking Architecture
- **Existing integer primary keys are NOT replaced**: `public.users.id` remains an `Int` (1, 2, 3...) to keep all 39 tables, foreign keys, JWT payloads, and frontend API contracts 100% unbroken.
- We add an `auth_id UUID UNIQUE` column to `public.users` linking to Supabase `auth.users.id` (UUID).
- RLS Helper Function:
  ```sql
  CREATE OR REPLACE FUNCTION public.get_current_user_id()
  RETURNS INT AS $$
    SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  $$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
  ```

### Authentication Import Process
- **Official Admin API Approach**:
  Existing Render user -> existing bcrypt password hash -> supported Supabase Auth Admin API (`supabase.auth.admin.createUser({ email, password_hash, ... })`) -> Supabase Auth user.
- **Zero Raw SQL Manipulation**: No raw SQL statements are run against `auth.users.encrypted_password`.
- **Zero Forced Password Resets**: Email identities and bcrypt password hashes are preserved directly.
- **JIT Fallback Bridge (Server-Side Node.js Bridge)**:
  If an existing user attempts login and their `auth_id` mapping is missing:
  - The server-side Node.js authentication bridge compares the supplied password against the stored bcrypt hash using `bcryptjs`.
  - Plaintext passwords are NEVER sent to PostgreSQL, logged, or stored in PostgreSQL.
  - Upon successful validation, the bridge calls `supabase.auth.admin.createUser` via the official Supabase Admin SDK, links `public.users.auth_id`, and returns the valid Supabase Auth session.
  - **User impact**: Zero forced password resets, zero account recreations, 100% credential continuity.

---

## 3. Storage Inventory & Security Architecture

### Physical Uploads Audit (`backend/uploads/`)
- **Total Directory Size**: **0 KB** (0 files currently in local development repository).
- **Subdirectory Breakdown**:
  - `backend/uploads/materials/`: 0 files, 0 KB
  - `backend/uploads/submissions/`: 0 files, 0 KB
  - `backend/uploads/avatars/`: 0 files, 0 KB
  - `backend/uploads/branding/`: 0 files, 0 KB
- **Supported File Types**: PDF, DOCX, MP4, WEBM, PNG, JPG, GIF.
- **Max Upload Enforcement**: Preserves dynamic `settings.maxUploadSize` parameter configured in LMS Admin Settings.

### Bucket Access Control & Signed URLs
- **`assignment-submissions` Bucket (PRIVATE)**: RLS policy restricts storage object access. Files fetched via server-side generated **Signed URLs** (1-hour TTL) accessible only by the student owner and assigned class teachers/admins.
- **`user-avatars` & `branding` Buckets (PUBLIC)**: Intentionally public assets.

---

## 4. Database Migration Safety & Staged Sequence

Render PostgreSQL database (`onereal-lms-db`) remains completely untouched during all phases.

### Exact Sequence
```
Render PostgreSQL Backup (pg_dump)
  │
  ▼
Isolated Staging Supabase Environment
  │
  ▼
Schema Validation (All 39 Tables & Indexes)
  │
  ▼
Data Migration & Foreign Key Restore
  │
  ▼
Row-Count & Relationship Verification
  │
  ▼
Primary Key Autoincrement Sequence Alignment (pg_catalog.setval)
  │
  ▼
Automated Security & RLS Test Suite Execution
  │
  ▼
Target Production Supabase Project Migration
```

---

## 5. Security & Row Level Security (RLS) Verification Test Suite

The security plan includes an automated test suite verifying that unauthorized actions explicitly **FAIL** (`403 Forbidden` / 0 rows returned):

| Test Scenario | Action Attempted | Expected Result |
| :--- | :--- | :--- |
| **Student A vs Student B Profile** | Student A `SELECT` Student B profile | **DENIED (0 rows)** |
| **Student A vs Student B Grades** | Student A `SELECT` Student B grades/results | **DENIED (0 rows)** |
| **Student A vs Student B Submissions** | Student A `SELECT` Student B submission files | **DENIED (0 rows)** |
| **Student A vs Student B Messages** | Student A `SELECT` Student B direct messages | **DENIED (0 rows)** |
| **Student A vs Student B Notifications**| Student A `SELECT` Student B notifications | **DENIED (0 rows)** |
| **Student A vs Student B Quiz Attempts** | Student A `SELECT` Student B quiz attempts | **DENIED (0 rows)** |
| **Grade Tampering** | Student `INSERT`/`UPDATE` `submissions.grade` | **DENIED (Forbidden)** |
| **Quiz Score Tampering** | Student `INSERT`/`UPDATE` `quiz_attempts.score` | **DENIED (Forbidden)** |
| **Points Tampering** | Student `UPDATE` `students.points` | **DENIED (Forbidden)** |
| **Quiz Answer Pre-fetch** | Student fetching `quiz_options.isCorrect` before submission | **DENIED (Excluded/Forbidden)** |
| **Teacher Boundary (Students)** | Teacher `SELECT` students outside assigned classes | **DENIED (0 rows)** |
| **Teacher Boundary (Grades)** | Teacher `UPDATE` grade outside assigned classes | **DENIED (Forbidden)** |
| **Admin Operations** | Admin performing administrative tasks | **PASS (Authorized)** |

---

## 6. Quiz Security & Complete Answer Isolation

- **Browser Isolation**: Student's query `get_student_quiz(quiz_id)` returns questions and options **strictly excluding** `isCorrect` at the SQL RPC level.
- **Server Auto-Grading**: Student submits option choices to `submit_quiz_attempt(quiz_id, answers_json)`. Validation, scoring, points awarding, and attempt storage happen 100% inside PostgreSQL RPC.
- **Multi-Vector Testing**: Verified against direct table queries, REST/Data API, SQL views, RPC functions, Edge Functions, browser network logs, and Supabase client queries.

---

## 7. Dynamic BECE / JHS Calculation

- **Core Subject Identification**: Core subjects (English Language, Mathematics, Integrated Science, Social Studies) are identified dynamically by matching subject names or `isCore = true` flags, not hard-coded database IDs.
- **Elective Selection**: Dynamically ranks remaining student subjects and selects the Top 2 highest-scoring electives.
- **Aggregate Formula**: Maps percentages to BECE Grade Points (1-9) and sums 4 Core + 2 Best Electives inside PostgreSQL RPC `calculate_bece_aggregate(student_id)`.

---

## 8. WebSocket -> Realtime Dual-Stack Transition

During the transition:
```
Existing Render WebSocket (/ws)
              +
Supabase Realtime Channels (messages, notifications)
        [RUN SIMULTANEOUSLY]
```
- **Verification Tests**: Real-time delivery of messages, notifications, dashboard updates, and multi-user concurrency.
- Custom Render WebSocket (`/ws`) is deactivated **only** after Supabase Realtime passes 100% verification on the frontend.

---

## 9. Free Plan Cost Estimate

**"Expected starting cost: $0/month if actual usage remains within the applicable Supabase Free-plan limits."**

- Database size: ~10–20 MB (Limit: 500 MB).
- File storage: 0 KB initial (Limit: 5 GB).
- MAUs: < 1,000 active users (Limit: 50,000 MAUs).

---

## 10. Rollback Strategy & 16-Point Decommissioning Checklist

Render services remain 100% active as an instant rollback option. Render will **NOT** be decommissioned until all 16 operational checkpoints pass audit:

1. [ ] Supabase Auth (Admin, Teacher, Student login & session persistence).
2. [ ] Database CRUD operations across 39 tables.
3. [ ] Storage file access & signed URL security.
4. [ ] Admin Portal functionality.
5. [ ] Teacher Portal functionality.
6. [ ] Student Portal functionality.
7. [ ] Quiz timing & attempt enforcement.
8. [ ] Quiz auto-grading & answer isolation.
9. [ ] Assignment submission & rubric scoring.
10. [ ] Primary percentage & letter grade calculations.
11. [ ] JHS BECE aggregate calculation (Dynamic 4 Core + Best 2 electives).
12. [ ] Student Risk Report analytics.
13. [ ] Realtime messaging & notification delivery.
14. [ ] Audit logging immutability.
15. [ ] RLS Security Test Suite (All 13 test scenarios pass/fail correctly).
16. [ ] Zero-downtime fallback verification.
