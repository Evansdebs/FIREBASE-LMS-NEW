# 🎓 ONEREAL LMS — Learning Management System

> A modern, full-stack, serverless Learning Management System built for schools and academic institutions. Powered by **React 18**, **TypeScript**, and **Google Firebase & Cloud Firestore**.
> 
> Developed by **EVANS K. DEBRAH, I.T. Specialist**.

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Tech Stack](#-tech-stack)
3. [System Architecture](#-system-architecture)
4. [Features by Role](#-features-by-role)
5. [Project Structure](#-project-structure)
6. [Prerequisites](#-prerequisites)
7. [Local Development Setup](#-local-development-setup)
8. [Firebase Configuration](#-firebase-configuration)
9. [Default Credentials](#-default-credentials)
10. [Firestore Data Schema](#-firestore-data-schema)
11. [Permission System](#-permission-system)
12. [Building for Production](#-building-for-production)
13. [Deployment Guide](#-deployment-guide)
14. [Developer Contact](#-developer-contact)

---

## 🌐 Project Overview

**ONEREAL LMS** is a state-of-the-art educational platform designed to streamline classroom management, digital assessments, student grading, and learning materials. It provides specialized interfaces for three core user roles: **Super Admin**, **Teacher**, and **Student**, powered by real-time reactive Firestore updates.

### Core Capabilities
- **Role-Based Access Control (RBAC)**: Granular permissions for Super Admins, Teachers, and Students.
- **Dynamic Assessment Engine**: MCQ quiz builder with timed countdowns, fullscreen lockdown rules, auto-grading, and leaderboard rankings.
- **Assignment & Submission Center**: Rich assignment descriptions, student file/text submissions, and teacher grading workflows.
- **Interactive Multi-Format Resource Library**: Upload and stream PDFs, Word documents, Excel sheets, videos (YouTube/Vimeo/direct), audio, and plain-text notes.
- **AI Tutor**: Integrated pedagogical assistant generating conceptual lesson explanations, key summaries, study notes, and practical tips.
- **Academic Report Cards**: Automated generation of branded student report cards and performance analytics with jsPDF.
- **Real-Time Communication**: Direct messaging with Firestore snapshot listeners and targeted system announcements.
- **Gamification & Wellness**: Focus Pomodoro Study Room with synthesized binaural audio, student points, shop redemption, and interactive PhET science simulations.
- **Live Video Classes**: Scheduling and direct joining of Google Meet / Zoom live sessions.
- **Dynamic Branding**: Real-time institution branding (school name, tagline, logos, lockdown flags).

---

## 🛠 Tech Stack

### Frontend & UI
| Technology | Purpose |
| :--- | :--- |
| **React 18** | High-performance declarative component architecture |
| **TypeScript** | Strict compile-time type safety across the entire application |
| **Vite 5** | Ultra-fast build tool and local development server |
| **TailwindCSS 3** | Utility-first, responsive modern styling |
| **ShadCN / Radix UI** | Accessible, robust UI primitives (dialogs, dropdowns, tabs, sliders) |
| **Lucide React** | Consistent modern icon system |
| **Framer Motion** | Micro-animations and page transitions |
| **Recharts** | Interactive charts and analytics visualization |
| **jsPDF & autoTable** | Automated client-side PDF generation for report cards and quizzes |
| **ExcelJS & XLSX** | Excel export/import and student bulk uploads |

### Backend & Cloud Infrastructure
| Technology | Purpose |
| :--- | :--- |
| **Firebase Auth** | Secure email/password user authentication and session management |
| **Cloud Firestore** | NoSQL, real-time reactive cloud database with automatic syncing |
| **Firebase Storage** | Scalable asset and document storage |

---

## 🏗 System Architecture

```
┌────────────────────────────────────────────────────────┐
│               Browser Client SPA (Vite + React)        │
│    ┌──────────────────────────────────────────────┐    │
│    │     UI Layer (Shadcn/UI + TailwindCSS)       │    │
│    └──────────────────────┬───────────────────────┘    │
│    ┌──────────────────────▼───────────────────────┐    │
│    │     Context Providers (Auth, Branding)       │    │
│    └──────────────────────┬───────────────────────┘    │
│    ┌──────────────────────▼───────────────────────┐    │
│    │     Firestore Service Layer                  │    │
│    │     (User, Academic, Quiz, Assignment,       │    │
│    │      Content, Message, Settings, Dashboard)  │    │
│    └──────────────────────┬───────────────────────┘    │
└───────────────────────────┼────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
    ┌───────▼────────┐             ┌────────▼─────────┐
    │  Firebase Auth │             │  Cloud Firestore │
    │  (Tokens & UIDs)│            │  (NoSQL Datastore)│
    └────────────────┘             └──────────────────┘
```

---

## 👥 Features by Role

### 👑 Super Admin
- **Dashboard**: School-wide KPIs (total students, active teachers, subjects, submissions, class distributions).
- **User Management**: Add, edit, activate/deactivate users, reset passwords, and bulk upload students via Excel.
- **Subject & Curriculum Center**: Manage academic classes, subjects, courses, and syllabus modules.
- **Permissions Matrix**: Granular per-teacher feature toggling.
- **System Settings & Branding**: Customize school name, portal branding, and exam lockdown mode.
- **Audit Logs**: Comprehensive activity log of administrative actions.

### 👨‍🏫 Teacher
- **Subject Command Center**: View assigned subjects, manage topics/modules, and upload learning resources.
- **Assessment Builder**: Create and configure timed MCQ quizzes, set pass criteria, and review student attempts.
- **Assignment Evaluator**: Publish assignments with deadlines, review student submissions, and assign scores and feedback.
- **Gradebook**: Comprehensive student grade overview and instant PDF report card generator.
- **Live Classes**: Schedule interactive online video sessions with Google Meet links.
- **Direct Messaging**: Communicate directly with students and parents in real time.

### 🎓 Student
- **Student Dashboard**: Enrolled courses, upcoming quizzes, pending assignments, points, and rank.
- **Subject Catalog & Modules**: Browse learning material, watch embedded video lessons, and download study guides.
- **Quiz Room**: Complete timed online quizzes in exam mode with anti-cheat lockdown safeguards.
- **Assignment Dropzone**: Submit text or file assignments and view teacher marks and feedback.
- **AI Tutor**: Instant, interactive tutoring on any topic with printable notes.
- **Study Room**: Pomodoro focus timer with binaural audio, ambient soundscapes, and point rewards.
- **Interactive Simulations**: Engage with interactive PhET science simulations.
- **Reward Shop**: Redeem earned points for educational rewards and badges.

---

## 📁 Project Structure

```
lms/
├── index.html                   # HTML entry point
├── package.json                 # Project dependencies and scripts
├── tsconfig.json                # TypeScript compiler configuration
├── vite.config.ts               # Vite configuration and path aliases
├── scripts/
│   └── seed-firebase.mjs        # Firebase initial data seeder
└── src/
    ├── App.tsx                  # Main app router and role-guarded routes
    ├── main.tsx                 # React entry point
    ├── index.css                # Global stylesheet & Tailwind directives
    ├── lib/
    │   ├── firebase.ts          # Firebase Auth, Firestore, and Storage instances
    │   ├── auth-context.tsx     # Real-time Auth context & state
    │   ├── branding-context.tsx # Real-time branding settings subscriber
    │   ├── utils.ts             # Tailwind class merging utility
    │   └── services/            # Firestore domain service modules
    │       ├── academicService.ts   # Classes, subjects, courses, topics, timetable
    │       ├── assignmentService.ts # Assignments, submissions, rubric grading
    │       ├── contentService.ts    # Materials, notes, forum, shop, simulations
    │       ├── dashboardService.ts  # Aggregated stats & analytics calculators
    │       ├── messageService.ts    # Direct chat & notification listeners
    │       ├── quizService.ts       # Quizzes, questions, attempts, leaderboards
    │       ├── settingsService.ts   # System settings, audit logs, live classes
    │       └── userService.ts       # User profiles, roles, and auth creation
    ├── components/
    │   ├── ui/                  # Reusable Shadcn UI component library
    │   ├── layout/              # Navigation bar, Sidebar, NotificationBell
    │   ├── dashboard/           # VideoPlayerModal, MaterialViewer, EditMaterialModal
    │   └── admin/               # BulkUploadModal and Admin tools
    └── pages/
        ├── AuthPage.tsx         # Login portal
        └── dashboard/           # Role-based dashboard views
            ├── DashboardHome.tsx
            ├── AcademicPage.tsx
            ├── CoursesPage.tsx
            ├── MySubjectPage.tsx
            ├── QuizzesPage.tsx
            ├── AssignmentsPage.tsx
            ├── GradebookPage.tsx
            ├── ResourceLibraryPage.tsx
            ├── AITutorPage.tsx
            ├── StudyRoomPage.tsx
            ├── SimulationsPage.tsx
            ├── ShopPage.tsx
            ├── ForumPage.tsx
            ├── MessagesPage.tsx
            ├── AnnouncementsPage.tsx
            ├── LiveClassesPage.tsx
            ├── TimetablePage.tsx
            ├── CalendarPage.tsx
            ├── AnalyticsPage.tsx
            ├── UserManagement.tsx
            ├── PermissionsPage.tsx
            ├── SettingsPage.tsx
            └── AuditLogsPage.tsx
```

---

## ⚡ Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm** or **pnpm**
- A **Google Firebase Project** with Firestore Database and Firebase Authentication enabled.

---

## 🚀 Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/onereal381-cmyk/lms.git
   cd lms
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory (see [Environment Variables](#-firebase-configuration) below).

4. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:8080](http://localhost:8080) (or the port indicated in the terminal) in your browser.

---

## 🔑 Firebase Configuration

Set your Firebase project credentials in `.env`:

```env
VITE_FIREBASE_API_KEY=AIzaSyDNgX8RJhyjb49CHjSKxrjrlJYjRwr01xw
VITE_FIREBASE_AUTH_DOMAIN=mylms-4d978.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=mylms-4d978
VITE_FIREBASE_STORAGE_BUCKET=mylms-4d978.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=999743430955
VITE_FIREBASE_APP_ID=1:999743430955:web:4572e0ab018b48803be56e
VITE_FIREBASE_MEASUREMENT_ID=G-7TL9SF6E9S
```

---

## 🔐 Default Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Super Admin** | `admin@onereal.edu` | `admin123` |
| **Teacher** | `teacher@onereal.edu` | `teacher123` |
| **Student** | `student@onereal.edu` | `student123` |

> *Note: On first startup, the application auto-provisions the Super Admin profile in Firebase Auth and Firestore if not already present.*

---

## 🗄 Firestore Data Schema

| Collection | Description | Primary Fields |
| :--- | :--- | :--- |
| `users/{uid}` | User accounts and profile data | `email`, `role`, `fullName`, `className`, `points`, `permissions` |
| `settings/system` | System configuration | `schoolName`, `tagline`, `logoUrl`, `lockdownMode` |
| `classes/{id}` | Academic grades/classes | `name`, `code`, `capacity`, `description` |
| `subjects/{id}` | Subject categories | `name`, `code`, `description` |
| `courses/{id}` | Course catalog | `title`, `description`, `subjectName`, `classIds`, `teacherIds` |
| `topics/{id}` | Syllabus modules | `title`, `description`, `orderIndex`, `courseId` |
| `materials/{id}` | Learning resources | `title`, `type`, `topicId`, `fileUrl`, `textContent`, `isGlobal` |
| `quizzes/{id}` | Assessments | `title`, `duration`, `dueDate`, `isPublished`, `classIds` |
| `quiz_questions/{id}` | MCQ items | `quizId`, `questionText`, `points`, `options: [{ label, text, isCorrect }]` |
| `quiz_attempts/{id}` | Student test results | `quizId`, `studentId`, `studentName`, `score`, `total`, `answers` |
| `assignments/{id}` | Homework & projects | `title`, `description`, `deadline`, `maxScore`, `classIds` |
| `submissions/{id}` | Student homework submissions | `assignmentId`, `studentId`, `content`, `grade`, `feedback` |
| `messages/{id}` | Direct chat conversations | `senderId`, `receiverId`, `content`, `participants: [uid1, uid2]` |
| `notifications/{id}` | Announcements & alerts | `title`, `message`, `isGlobal`, `targetRole`, `readBy` |
| `notes/{id}` | Study notebooks | `title`, `content`, `userId`, `isShared` |
| `live_classes/{id}` | Scheduled video classes | `title`, `meetingUrl`, `startTime`, `duration`, `classId` |
| `timetable/{id}` | Period schedule | `day`, `period`, `time`, `subjectId`, `classId`, `teacherId` |
| `shop_items/{id}` | Point rewards store | `title`, `description`, `pointsCost`, `status`, `category` |
| `simulations/{id}` | Interactive science labs | `title`, `subject`, `simUrl`, `description` |
| `audit_logs/{id}` | Security trail | `action`, `user`, `details`, `timestamp` |

---

## 🛡 Permission System

Teachers can have customized granular permissions toggled from the **Permissions** panel:
- `canCreateQuizzes`: Permission to build and publish quizzes.
- `canGradeAssignments`: Permission to review and score student homework.
- `canUploadMaterials`: Permission to publish curriculum files.
- `canScheduleLiveClasses`: Permission to create video meetings.
- `canViewGradebook`: Permission to access cross-class gradebooks and export report cards.

---

## 📦 Building for Production

To create an optimized production bundle:

```bash
npm run build
```

This compiles TypeScript, bundles React components, and generates minified assets in the `dist/` directory.

---

## 🌐 Deployment Guide

### Deploying to Firebase Hosting

1. **Install Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase in project directory**:
   ```bash
   firebase init hosting
   ```
   - Set public directory to `dist`
   - Configure as single-page app (SPA): `Yes`

4. **Build and Deploy**:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

### Deploying to Vercel / Netlify
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Single Page Application Rewrite**: Redirect all routes (`/*`) to `/index.html`.

---

## 👨‍💻 Developer Contact

- **Lead Developer**: Evans K. Debrah (I.T. Specialist)
- **Organization**: ONEREAL ACADEMY
- **GitHub**: [@onereal381-cmyk](https://github.com/onereal381-cmyk)
- **License**: MIT
