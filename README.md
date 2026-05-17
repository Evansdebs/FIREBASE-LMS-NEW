# 🎓 ONEREAL LMS — Learning Management System

> A full-stack, role-based Learning Management System built for modern schools. Developed by **EVANS K. DEBRAH, I.T. Specialist**.

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Tech Stack](#-tech-stack)
3. [System Architecture](#-system-architecture)
4. [Features by Role](#-features-by-role)
5. [Project Structure](#-project-structure)
6. [Prerequisites](#-prerequisites)
7. [Local Development Setup](#-local-development-setup)
8. [Environment Variables](#-environment-variables)
9. [Database Management](#-database-management)
10. [Running the Application](#-running-the-application)
11. [Default Credentials](#-default-credentials)
12. [Permission System](#-permission-system)
13. [API Overview](#-api-overview)
14. [Building for Production](#-building-for-production)
15. [Deployment Guide](#-deployment-guide)
16. [Troubleshooting](#-troubleshooting)
17. [Developer Contact](#-developer-contact)

---

## 🌐 Project Overview

**ONEREAL LMS** is a comprehensive Learning Management System designed to digitize and streamline educational operations. It supports three user roles — **Super Admin**, **Teacher**, and **Student** — each with tailored dashboards and granular, permission-based access control.

### Core Capabilities
- Role-based access control with granular permissions per teacher
- Interactive dashboards with real-time metrics and analytics
- Quiz creation, management, and automated grading
- Assignment submission and grading workflow
- Live class scheduling and management
- Resource library with file upload support
- System-wide announcements and direct messaging
- Gamification (student points, achievements, simulation lab)
- Audit logging for all system actions
- Backup and restore system
- E-Store for educational resources

---

## 🛠 Tech Stack

### Frontend
| Technology | Purpose |
| :--- | :--- |
| **React 18** | UI framework |
| **TypeScript** | Type safety |
| **Vite 5** | Build tool & dev server |
| **TailwindCSS 3** | Utility-first styling |
| **ShadCN/UI** | Pre-built accessible components |
| **React Router v6** | Client-side routing |
| **TanStack Query** | Data fetching & caching |
| **Recharts** | Data visualization |
| **Framer Motion** | Animations |
| **jsPDF** | PDF report generation |

### Backend
| Technology | Purpose |
| :--- | :--- |
| **Node.js** | Runtime environment |
| **Express.js** | Web framework |
| **Prisma ORM** | Database access layer |
| **SQLite** | Database (file-based, zero config) |
| **JWT** | Authentication tokens |
| **bcryptjs** | Password hashing |
| **Multer** | File upload handling |
| **WebSockets (ws)** | Real-time updates |
| **Helmet / CORS** | Security headers |

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────┐
│              Browser (Port 8080)             │
│         React + Vite Frontend SPA           │
└─────────────────┬───────────────────────────┘
                  │ HTTP / WebSocket Proxy
                  │ /api  ──► :5000
                  │ /ws   ──► :5000
┌─────────────────▼───────────────────────────┐
│        Express.js Backend (Port 5000)        │
│  ┌──────────────┐  ┌──────────────────────┐ │
│  │  Auth/JWT    │  │  Route Controllers   │ │
│  │  Middleware  │  │  (Admin/Teacher/     │ │
│  │  (protect,   │  │   Student/Auth)      │ │
│  │  authorize)  │  └──────────────────────┘ │
│  └──────────────┘                           │
│  ┌──────────────────────────────────────┐   │
│  │          Prisma ORM                  │   │
│  └──────────────┬───────────────────────┘   │
└─────────────────┼───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│         SQLite Database (dev.db)             │
│         Located: backend/prisma/dev.db       │
└─────────────────────────────────────────────┘
```

**Vite** proxies all `/api` and `/ws` requests to the backend automatically during development, so you never need to configure CORS manually.

---

## 👥 Features by Role

### 🔴 Super Admin
| Feature | Description |
| :--- | :--- |
| **Dashboard** | System-wide stats, student rankings, teacher participation |
| **User Management** | Create, edit, disable, bulk-upload students and teachers |
| **Academic Setup** | Manage classes and subjects |
| **Permissions** | Grant/revoke teacher-level permissions per feature |
| **Subjects / Courses** | Create and assign global courses |
| **Quizzes** | View, manage, and export all quizzes |
| **Assignments** | View all assignment submissions |
| **Gradebook** | Global grade view across all students |
| **Resource Library** | Upload and manage global learning materials |
| **Announcements** | Send system-wide notifications |
| **Analytics** | Gender demographics, usage stats |
| **Audit Logs** | View and delete all system activity records |
| **Settings** | Branding, maintenance mode, backup & restore |
| **E-Store** | Approve/manage educational resource listings |
| **Live Classes** | View all scheduled sessions |

### 🟡 Teacher
| Feature | Description |
| :--- | :--- |
| **Dashboard** | My subjects, student performance, at-risk students |
| **Subjects** | View assigned courses and topics |
| **Quizzes** | Create, edit, and grade quizzes for classes |
| **Assignments** | Post assignments, review and grade submissions |
| **Gradebook** | Per-course grading |
| **Live Classes** | Schedule and manage live sessions |
| **Resource Library** | Upload teaching materials *(if permitted)* |
| **Announcements** | Post class announcements *(if permitted)* |
| **Messages** | Direct messaging to students |
| **Forums** | Engage in discussion boards |
| **Notes** | Personal notes system |
| **E-Store** | List educational resources for sale |
| **Simulation Lab** | Access interactive simulations |
| **Contact Developer** | View developer support information |

### 🟢 Student
| Feature | Description |
| :--- | :--- |
| **Dashboard** | My subjects, grades, progress, upcoming events |
| **Subjects** | Browse and access enrolled courses, topics, materials |
| **Quizzes** | Take available quizzes; see results |
| **Assignments** | Submit assignments; view grades and feedback |
| **Gradebook** | View personal academic records; download PDF report |
| **Live Classes** | View and join scheduled sessions |
| **Resource Library** | Access learning materials |
| **Announcements** | Receive system and class announcements |
| **Messages** | Message teachers |
| **Forums** | Participate in discussion boards |
| **Notes** | Personal notes system |
| **E-Store** | Browse available educational resources |
| **Simulation Lab** | Run simulations (3 pts/day limit) |
| **Participation** | View points, achievements, and leaderboard |
| **Contact Developer** | View developer support information |

---

## 📁 Project Structure

```
new LMS/
├── README.md                   # This file
├── index.html                  # Entry HTML
├── vite.config.ts              # Vite + proxy config
├── package.json                # Frontend dependencies
├── tailwind.config.ts          # Tailwind design tokens
├── tsconfig.json               # TypeScript config
│
├── src/                        # Frontend source
│   ├── App.tsx                 # Routes & providers
│   ├── index.css               # Global CSS & design system
│   ├── main.tsx                # Vite entry point
│   │
│   ├── components/
│   │   ├── dashboard/          # Reusable dashboard widgets
│   │   │   └── DeveloperInfo.tsx
│   │   ├── layout/
│   │   │   ├── AppSidebar.tsx  # Sidebar navigation
│   │   │   └── DashboardLayout.tsx
│   │   └── ui/                 # ShadCN/UI components
│   │
│   ├── pages/
│   │   ├── Login.tsx           # Login page
│   │   ├── NotFound.tsx
│   │   ├── auth/
│   │   │   └── ChangePassword.tsx
│   │   └── dashboard/          # All dashboard pages
│   │       ├── DashboardHome.tsx
│   │       ├── UserManagement.tsx
│   │       ├── PermissionsPage.tsx
│   │       ├── AuditLogsPage.tsx
│   │       ├── SettingsPage.tsx
│   │       ├── CoursesPage.tsx
│   │       ├── QuizzesPage.tsx
│   │       ├── AssignmentsPage.tsx
│   │       ├── GradebookPage.tsx
│   │       ├── ResourceLibraryPage.tsx
│   │       ├── AnnouncementsPage.tsx
│   │       ├── AnalyticsPage.tsx
│   │       ├── LiveClassesPage.tsx
│   │       ├── MessagesPage.tsx
│   │       ├── ForumPage.tsx
│   │       ├── NotesPage.tsx
│   │       ├── ShopPage.tsx
│   │       ├── SimulationsPage.tsx
│   │       ├── ParticipationPage.tsx
│   │       └── AcademicPage.tsx
│   │
│   └── lib/
│       ├── api.ts              # Axios API client
│       ├── auth-context.tsx    # Auth state & JWT
│       └── branding-context.tsx# School branding state
│
└── backend/
    ├── package.json            # Backend dependencies
    ├── .env                    # Environment variables
    │
    ├── prisma/
    │   ├── schema.prisma       # Full database schema
    │   ├── dev.db              # SQLite database file
    │   └── seed.js             # Database seed script
    │
    ├── archives/               # Backup archives (.tar.gz)
    ├── uploads/                # Uploaded files (materials)
    │
    └── src/
        ├── server.js           # Express app entry point
        ├── config/
        │   └── prisma.js       # Prisma client singleton
        ├── controllers/
        │   ├── adminController.js
        │   ├── teacherController.js
        │   ├── studentController.js
        │   ├── authController.js
        │   └── simulationController.js
        ├── middleware/
        │   ├── authMiddleware.js      # protect, admin, authorize
        │   ├── maintenanceMiddleware.js
        │   ├── cacheMiddleware.js
        │   └── uploadMiddleware.js    # Multer config
        └── routes/
            ├── authRoutes.js
            ├── adminRoutes.js
            ├── teacherRoutes.js
            └── studentRoutes.js
```

---

## ✅ Prerequisites

Ensure the following are installed on your system before getting started:

- **Node.js** v18 or newer — [Download](https://nodejs.org/)
- **npm** v9 or newer (comes with Node.js)
- **Git** (optional, for version control)

---

## 🚀 Local Development Setup

### Step 1 — Clone the project

```bash
git clone <your-repo-url>
cd "new LMS"
```

Or simply open the project folder if you already have it locally.

---

### Step 2 — Install frontend dependencies

```bash
npm install
```

---

### Step 3 — Install backend dependencies

```bash
cd backend
npm install
```

---

### Step 4 — Configure environment variables

In `backend/.env`, ensure the following are set (defaults shown below):

```env
DATABASE_URL="file:./dev.db"
PORT=5000
JWT_SECRET="onereal_lms_super_secret_key_2026"
JWT_EXPIRES_IN="7d"
NODE_ENV="development"
MAINTENANCE_PASSWORD="Onereal22"
GOOGLE_AI_KEY="Your_Gemini_API_Key_Here"
```

### 🧠 Gemini AI Setup
To use the **AI Tutor** feature, you must obtain an API Key from [Google AI Studio](https://aistudio.google.com/). 
1. Create a key.
2. Add it to your `.env` as `GOOGLE_AI_KEY`.
3. If deploying to **Render**, add it in the **Environment** tab of your dashboard.

### 🏆 Highest Grade Logic
Quizzes are now configured to only record and calculate based on the **student's highest score** per quiz. Re-attempts do not penalize the student's average unless they improve their score.

> ⚠️ **Security Note**: Change `JWT_SECRET` and `MAINTENANCE_PASSWORD` to strong, unique values before deploying to production.

---

### Step 5 — Set up the database

```bash
# From inside the /backend directory:

# Push schema to database (creates tables)
npm run db:push

# Seed with default admin account
npm run db:seed
```

---

## 🔑 Default Credentials

After seeding, an admin account is created automatically:

| Field | Value |
| :--- | :--- |
| **Email** | `admin@onereal.com` |
| **Password** | `admin123` |
| **Role** | Super Admin |

> ⚠️ Change this password immediately after first login via **Settings → Security**.

---

## ▶️ Running the Application

You need **two terminals** running simultaneously.

### Terminal 1 — Backend Server

```bash
cd "new LMS/backend"
npm run dev
```

The backend starts on **http://localhost:5000**

### Terminal 2 — Frontend Dev Server

```bash
cd "new LMS"
npm run dev
```

The frontend starts on **http://localhost:8080**

Open your browser at: **[http://localhost:8080](http://localhost:8080)**

---

## 🗄 Database Management

All commands are run from inside the `backend/` directory.

| Command | Description |
| :--- | :--- |
| `npm run db:push` | Sync Prisma schema with the database (run after schema changes) |
| `npm run db:seed` | Seed the database with the default admin account |
| `npm run db:generate` | Regenerate Prisma client (after schema.prisma edits) |
| `npm run db:studio` | Open Prisma Studio (visual DB viewer at port 5555) |

### Viewing the database visually

```bash
cd backend
npm run db:studio
```

Open **http://localhost:5555** to browse and edit records.

---

## 🔐 Permission System

The ONEREAL LMS uses a **granular, role-based permission system** for teachers. Admins can selectively grant specific abilities to teachers from the **Permissions** page.

### Available Permission Keys

| Permission Key | What It Grants |
| :--- | :--- |
| `manage_settings` | Access to the Settings page |
| `manage_roles` | Access to the Permissions page itself |
| `view_audit_logs` | Access to the Audit Logs page |
| `manage_users` | Create, edit, and disable users |
| `manage_academic` | Create and configure Subjects and Classes |
| `manage_courses` | Create and assign global Courses |
| `manage_resources` | Upload/edit items in the Resource Library |
| `approve_content` | Moderate quizzes and assignments |
| `send_announcements` | Post system-wide announcements |
| `view_analytics` | Access the global Analytics dashboard |
| `view_all_grades` | Access the global Gradebook |

Permissions are stored as a JSON object on the user record. The sidebar and all quick-action buttons automatically reflect granted permissions.

---

## 📡 API Overview

The backend exposes a RESTful API. All protected routes require a Bearer token in the `Authorization` header.

### Base URL
- Development: `http://localhost:5000/api`

### Route Groups

| Prefix | Auth | Description |
| :--- | :--- | :--- |
| `/api/auth` | Public / Protected | Login, logout, change password |
| `/api/admin` | Super Admin / Permitted Teacher | Full administrative operations |
| `/api/teacher` | Teacher | Teacher-specific CRUD operations |
| `/api/student` | Student | Student-specific read/submit operations |

### Key Endpoints (Admin)

```
GET    /api/admin/dashboard          → System stats
GET    /api/admin/users              → All users
POST   /api/admin/users              → Create user
PUT    /api/admin/users/:id          → Update user
DELETE /api/admin/users/:id          → Delete user
GET    /api/admin/audit-logs         → Audit log list
DELETE /api/admin/audit-logs/:id     → Delete audit log entry
GET    /api/admin/analytics          → Analytics data
GET    /api/admin/backups            → List backups
POST   /api/admin/backups            → Create backup
DELETE /api/admin/backups/:filename  → Delete backup
POST   /api/admin/backups/:file/restore → Restore backup
GET    /api/admin/settings           → System settings
PUT    /api/admin/settings           → Update settings
```

---

## 📦 Building for Production

### Build the Frontend

```bash
# From the root "new LMS" directory
npm run build
```

Output is generated in the `dist/` folder. This folder contains static files ready to be served by any web server (Nginx, Apache, etc.).

### Run Backend in Production

```bash
cd backend
# Set NODE_ENV=production in .env first!
npm start
```

---

## 🌍 Deployment Guide

### Option A — VPS / Cloud Server (Recommended)

#### 1. Prepare the server
Install Node.js 18+ and a process manager like PM2:
```bash
npm install -g pm2
```

#### 2. Copy project files
Upload your project to the server (via FTP, SCP, or Git).

#### 3. Install dependencies
```bash
# Root (frontend)
npm install
npm run build

# Backend
cd backend
npm install
npm run db:push
```

#### 4. Configure environment
Edit `backend/.env` with production values:
```env
DATABASE_URL="file:./dev.db"
PORT=5000
JWT_SECRET="<STRONG_RANDOM_SECRET_HERE>"
JWT_EXPIRES_IN="7d"
NODE_ENV="production"
MAINTENANCE_PASSWORD="<STRONG_PASSWORD_HERE>"
```

#### 5. Start the backend with PM2
```bash
cd backend
pm2 start src/server.js --name "onereal-backend"
pm2 save
pm2 startup
```

#### 6. Serve the frontend with Nginx
Install Nginx and create a site config:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Serve the built frontend
    root /path/to/new-LMS/dist;
    index index.html;

    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to backend
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

#### 7. Enable HTTPS with Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

### Option B — Railway / Render / Fly.io (PaaS)

1. **Backend**: Deploy the `backend/` folder as a Node.js service. Set the start command to `node src/server.js`. Add all `.env` values as environment variables in the platform dashboard.

2. **Frontend**: After running `npm run build`, deploy the `dist/` folder to a static host like **Netlify**, **Vercel**, or **GitHub Pages**.

3. **Update the API URL**: In the frontend, update `vite.config.ts` or create a `.env.production` file with:
```
VITE_API_URL=https://your-backend-url.railway.app
```
And update `src/lib/api.ts` to use `import.meta.env.VITE_API_URL` as the base URL.

---

### Option C — Docker (Advanced)

Create a `Dockerfile` in the root:

```dockerfile
# Backend stage
FROM node:18-alpine AS backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ ./
RUN npx prisma generate
EXPOSE 5000
CMD ["node", "src/server.js"]
```

And a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=your_secret_here
      - DATABASE_URL=file:./dev.db
    volumes:
      - ./backend/prisma:/app/backend/prisma
      - ./backend/uploads:/app/backend/uploads
      - ./backend/archives:/app/backend/archives
```

---

## 🔧 Troubleshooting

### App won't start / Port already in use
```bash
# Kill process on port 5000 (Windows)
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Kill process on port 8080
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

### Database errors / Prisma issues
```bash
cd backend
npx prisma generate
npm run db:push
```

### "Cannot find module" errors after update
```bash
# Frontend
npm install

# Backend
cd backend
npm install
```

### Login fails with correct credentials
1. Verify the backend is running on port 5000.
2. Check `backend/.env` has a valid `JWT_SECRET`.
3. Run `npm run db:seed` again to reset the admin account.

### Permissions not updating in UI
- Log out and log back in. The JWT token must be refreshed.
- Ensure the backend is restarted after controller changes.

---

## 👨‍💻 Developer Contact

For technical support, bug reports, or custom development requests, contact the developer:

| Detail | Info |
| :--- | :--- |
| **Name** | EVANS K. DEBRAH |
| **Title** | I.T. Specialist |
| **Phone / WhatsApp** | +233 257 537 457 |
| **Alt. Phone / WhatsApp** | +233 545 153 303 |
| **Email** | evansdebrah111@gmail.com |
| **Backup Email** | onereal381@gmail.com |

> For fastest response, use **WhatsApp** messaging.

---

## 📄 License

This project is proprietary software developed for **ONEREAL Educational Services**. All rights reserved.

© 2026 EVANS K. DEBRAH — ONEREAL LMS
