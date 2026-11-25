# Cadence — Full-Stack Task Management System

Cadence is a full-stack SaaS task management platform built with **React, Vite, Tailwind CSS, Framer Motion, Recharts, Express.js, Socket.io, Drizzle ORM, PostgreSQL (Cloud SQL), and Firebase Auth / JWT**.

---

## Core Capabilities

- **Animated Product Landing Page**: Hero narrative (`Assign Work. Track Progress. Get Things Done.`), How It Works flow, Bento feature showcase, interactive workspace preview, Manager vs. Employee benefits, customer proof, pricing tiers, FAQ accordion, and validated **Book a Demo / Contact** intake persisted to PostgreSQL.
- **Role-Based Dashboards**:
  - **Admin / Manager**: Create and manage projects, invite team members, assign/reassign tasks to single or multiple employees, track KPIs & workload balance, send reminder notifications, and view team performance reports.
  - **Employee**: View assigned tasks, deadlines, and instructions; update task status (`To Do`, `In Progress`, `On Hold`, `Completed`); check off sub-tasks; upload file attachments; post comments; and monitor personal calendar deadlines.
- **Real-Time Multi-User Sync**: Powered by **Socket.io** attached to the Express HTTP server on port `3000` for instant Kanban transitions, task assignments, comments, and live notifications.
- **Analytics & AI Briefing**: Recharts visualizations covering Total Tasks, Completed, In Progress, Overdue, Completion Rate, Average Completion Time, Workload by Employee, and Project Progress %, plus a Gemini-powered High-Priority Briefing.

---

## Tech Stack

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4, Framer Motion, Lucide React, Recharts, Socket.io Client
- **Backend**: Node.js, Express.js, Socket.io, Multer, `@google/genai`, `bcryptjs`, `jsonwebtoken`, `firebase-admin`
- **Database**: PostgreSQL (Cloud SQL) via Drizzle ORM (`src/db/schema.ts`)

---

## Environment Variables

Platform-managed database credentials (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`) are injected by Cloud SQL in AI Studio. Application secrets belong in server environment variables:

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | Optional (for AI briefings) | Server-side Google Gemini API key |
| `JWT_SECRET` | Optional (falls back to secure runtime key) | Secret used to sign and verify JWT bearer tokens |
| `PORT` | Optional (defaults to `3000`) | HTTP & WebSocket server port |

See `.env.example` for template placeholders.

---

## Database Entities (`src/db/schema.ts`)

- `users`: `id`, `uid`, `name`, `email`, `password_hash`, `role`, `department`, `job_title`, `avatar`, `is_active`, `created_at`
- `projects`: `id`, `name`, `description`, `color`, `owner_id`, `start_date`, `deadline`, `status`, `created_at`
- `tasks`: `id`, `project_id`, `title`, `description`, `assignee_id`, `assignee_ids`, `created_by_id`, `due_date`, `priority`, `category`, `status`, `tags`, `subtasks`, `attachments`, `archived`, `completed_at`, `created_at`, `updated_at`
- `comments`: `id`, `task_id`, `user_id`, `message`, `attachments`, `created_at`
- `notifications`: `id`, `user_id`, `task_id`, `sender_id`, `message`, `type`, `is_read`, `created_at`
- `activity_logs`: `id`, `task_id`, `project_id`, `user_id`, `action`, `old_value`, `new_value`, `summary`, `created_at`
- `password_reset_tokens` & `demo_requests`

---

## REST API Reference

### Authentication & Profile
- `GET /api/auth/bootstrap-status` — Check whether initial workspace Admin claim is available
- `POST /api/auth/claim-admin` — Claim first-run Workspace Administrator account
- `POST /api/auth/signup` — Register a new `employee` or `manager` account
- `POST /api/auth/login` — Authenticate with email & password (returns JWT)
- `POST /api/auth/forgot-password` — Request a password reset token
- `POST /api/auth/reset-password` — Complete password reset with token
- `GET /api/auth/me` — Fetch authenticated user profile (JWT or Firebase ID token)
- `PATCH /api/auth/profile` — Update profile fields or change password

### Projects, Tasks, Attachments & Comments
- `GET /api/projects`, `POST /api/projects`, `PATCH /api/projects/:id`, `DELETE /api/projects/:id`
- `GET /api/tasks?showArchived=false`, `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id`
- `POST /api/tasks/:id/remind` — Send reminder notifications to task assignees (Admin/Manager)
- `POST /api/tasks/:id/attachments` — Upload up to 3 files (`5 MB` max each via Multer)
- `GET /api/uploads/:filename` — Authenticated file download
- `GET /api/tasks/:id/comments`, `POST /api/tasks/:id/comments`

### Team, Notifications, Analytics & AI
- `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all`
- `GET /api/analytics?scope=all|mine` — Workspace KPIs, employee workload, project progress, and throughput
- `GET /api/activity` — Chronological workspace audit log
- `POST /api/demo-requests` — Public landing page demo & contact submission
- `POST /api/gemini/priority-briefing`, `POST /api/gemini/chat`

---

## Running Locally

```bash
npm install
npm run dev
```

For production build verification:

```bash
npm run build
npm start
```
