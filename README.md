# ReachInbox - Email Scheduler

A full-stack email scheduling application for **ReachInbox**, a product of **Outbox Labs** focused on transforming cold email outreach with AI-driven workflows. Users register/login, compose emails, and schedule them for a future time. A **BullMQ worker** picks up due jobs, sends the email via **Nodemailer** (Ethereal or a real SMTP relay), and records the result. Scheduled and sent emails are shown in a React dashboard.

- **Backend:** Node.js, TypeScript, Express, BullMQ, Redis, SQLite (`node:sqlite`), Nodemailer, JWT auth, Zod validation
- **Frontend:** React, TypeScript, Vite, React Router, Axios

---

## 1. Features

### Backend (Express + Redis + BullMQ + DB)
- **Auth** - register / login / me (JWT, bcrypt password hashing)
- **Scheduling** - create an email with a future `scheduledAt`; the job is put on a BullMQ queue with the matching delay
- **Worker** - dedicated BullMQ Worker (configurable concurrency) processes due jobs and sends via Nodemailer
- **Persistence** - all emails are stored in SQLite; on restart, pending jobs are recovered and re-added to Redis (idempotent by job id)
- **Rate limiting** - per-user, fixed-window limit (default 50 scheduled emails/hour) enforced on `POST /api/emails`
- **Concurrency + throughput limits** - BullMQ Worker `concurrency` and Queue `limiter` (max jobs / duration)
- **Cancel** - a scheduled email can be cancelled and removed from the queue
- **Email delivery** - Ethereal test account by default, configurable SMTP, with a JSON-transport fallback when no real server is reachable

### Frontend (React + TypeScript)
- **Login / Register** pages with validation and loading states
- **Dashboard** with three tabs: **Compose**, **Scheduled**, **Sent**
- **Compose** - form for recipient, subject, body, local date/time picker; success toast
- **Scheduled** - table (email, subject, scheduled time, status) with loading + empty states, auto-refresh, and **Cancel** (with confirmation modal)
- **Sent** - table (email, subject, sent time, status) with loading + empty states, auto-refresh, Ethereal **Preview** link / message ID copy
- **Reusable UI kit** - `Button`, `Input`, `Textarea`, `Select`, `Modal`, `DataTable`, `Badge`, `EmptyState`, `Spinner`, toasts
- **Typed API client** (Axios) with typed request/response interfaces and centralized error handling

---

## 2. How it works

### Scheduling
1. `POST /api/emails` validates the payload, checks the per-user rate limit, inserts the email into SQLite (`status = scheduled`), and calls `queue.add('send-email', data, { jobId, delay })`.
2. BullMQ holds the job until its `delay` elapses. The `jobId` is the email `id`, which makes re-adding idempotent.
3. When the delay elapses, the Worker picks up the job, marks the email `processing`, and sends it.
4. On success the row becomes `sent` (with `sent_at` and send metadata). On failure it becomes `failed` and BullMQ retries (exponential backoff, max 3 attempts).

### Persistence on restart
Emails live in SQLite. On startup the app calls `recoverPendingJobs()`, which queries all `scheduled`/`processing` emails and re-adds each to the queue with `jobId = email.id` and the remaining delay. Because the job id is deterministic, BullMQ ignores duplicates if the job already still exists; any job that was lost (e.g. Redis stopped without persistence) is re-created, so future emails still send after a restart.

### Rate limiting & concurrency
- **Per-user rate limit:** a fixed 1-hour window counter in SQLite. Exceeding `USER_EMAIL_RATE_LIMIT` returns `429`.
- **Queue throughput:** BullMQ `limiter` (`QUEUE_RATE_LIMIT_MAX` jobs per `QUEUE_RATE_LIMIT_MS`) throttles how fast jobs are processed.
- **Worker concurrency:** `QUEUE_CONCURRENCY` controls how many jobs the Worker processes in parallel.

---

## 3. Prerequisites

- Node.js **>= 22.5** (Node 24 recommended; uses the built-in `node:sqlite` module)
- **Redis** (required by BullMQ). Easiest: Docker
- npm (v9+)

> The SQL database is Node's built-in `node:sqlite`, so **no separate DB server** is needed.

---

## 4. Setup

### 4.1 Install dependencies

```bash
# from the repo root
npm install
```

This installs `backend/` and `frontend/` via npm workspaces.

### 4.2 Start Redis

Either Docker (recommended):

```bash
docker compose up -d redis
```

or a local Redis on `redis://localhost:6379`. If your Redis is elsewhere, set `REDIS_URL` in `backend/.env`.

### 4.3 Configure the backend

```bash
cd backend
cp .env.example .env
# edit values if needed
```

Default `.env` values work out of the box:
- `ETHEREAL=true` -> an Ethereal test inbox is created automatically
- Database file at `backend/data/outbox.db`
- Redis at `redis://localhost:6379`

### 4.4 Run the backend (API + worker)

```bash
# from the repo root
npm run dev:server      # API + in-process worker (WORKER_MODE=all)
```

Or run the API and worker as separate processes:

```bash
# Terminal A - API
npm --workspace backend run dev

# Terminal B - worker only
npm --workspace backend run dev:worker
```

`WORKER_MODE=all` (default) runs the worker in the same process as the API. Set `WORKER_MODE=server` to run the API without starting a worker (e.g. if you run `dev:worker` separately).

### 4.5 Run the frontend

```bash
# from the repo root
npm run dev:frontend
```

The Vite dev server runs on `http://localhost:5173` and proxies `/api` to the backend on `http://localhost:5000`.

Open http://localhost:5173, register an account, compose a scheduled email (set a time a minute or two in the future), then watch it move from **Scheduled** to **Sent**.

### 4.6 Run everything in one terminal

From the repo root:

```bash
npm run dev
```

This starts the API, the BullMQ worker, and the Vite frontend together with `concurrently`. The API runs on `http://localhost:5000`, the worker in-process, and the frontend on `http://localhost:5173`.

---

## 5. Ethereal Email & environment variables

By default the app auto-creates a free Ethereal test account. When a job is sent, the worker logs the account and the Sent tab shows an Ethereal **Preview** link so you can read the actual message.

```env
ETHEREAL=true
```

To use a real/relay SMTP server instead:

```env
ETHEREAL=false
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_user
SMTP_PASS=your_password
SMTP_FROM=Email Scheduler <no-reply@example.com>
```

If Ethereal and SMTP are both unavailable (e.g. offline demo), the app falls back to a JSON transport that logs the message and still marks the email `sent`, so **scheduling still works end-to-end without a real mail server**.

### Backend env variables
| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `5000` | API port |
| `WORKER_MODE` | `all` | `all` / `server` (whether the API also starts the worker) |
| `JWT_SECRET` | `dev-secret-change-me` | JWT signing secret |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `DATABASE_PATH` | `./data/outbox.db` | SQLite file path |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `ETHEREAL` | `true` | Use Ethereal test account |
| `SMTP_*` | - | Optional real SMTP config |
| `QUEUE_CONCURRENCY` | `2` | Worker concurrency |
| `QUEUE_RATE_LIMIT_MAX` | `10` | Jobs processed per window |
| `QUEUE_RATE_LIMIT_MS` | `1000` | Window length (ms) |
| `USER_EMAIL_RATE_LIMIT` | `50` | Emails per user per hour |

### Frontend env variables
| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_URL` | `/api` | Backend base URL (leave as `/api` for the dev proxy) |

---

## 6. API Reference

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | - | Register, returns `{ user, token }` |
| `POST` | `/api/auth/login` | - | Login, returns `{ user, token }` |
| `GET` | `/api/auth/me` | Bearer | Current user |
| `POST` | `/api/emails` | Bearer | Schedule an email (rate-limited) |
| `GET` | `/api/emails/scheduled` | Bearer | List scheduled emails |
| `GET` | `/api/emails/sent` | Bearer | List sent emails |
| `DELETE` | `/api/emails/:id` | Bearer | Cancel a scheduled email |
| `GET` | `/api/health` | - | Health check |

Example schedule request:

```json
{
  "to": "recipient@example.com",
  "subject": "Meeting reminder",
  "body": "Hi, reminder about our meeting.",
  "scheduledAt": "2026-08-30T12:00:00.000Z"
}
```

---

## 7. Project structure

```
outbox-email-scheduler/
├── backend/
│   ├── src/
│   │   ├── config/       # env, db, redis, email (Ethereal/SMTP)
│   │   ├── controllers/  # auth + email handlers
│   │   ├── db/           # SQLite schema
│   │   ├── middleware/   # auth, rate limit, errors
│   │   ├── routes/       # Express routers
│   │   ├── services/     # auth, email, queue, scheduler
│   │   ├── utils/        # AppError, asyncHandler, http
│   │   ├── workers/      # BullMQ email worker
│   │   ├── types/        # shared types
│   │   ├── app.ts        # Express app
│   │   └── index.ts      # bootstrap
│   └── .env.example
├── frontend/
│   └── src/
│       ├── api/          # typed API clients
│       ├── components/   # ui kit + layout
│       ├── context/      # Auth, Toast
│       ├── hooks/        # useApiData
│       ├── pages/        # Login, Register, Compose, Scheduled, Sent
│       ├── routes/       # ProtectedRoute
│       ├── utils/        # formatting helpers
│       ├── App.tsx
│       └── main.tsx
├── docker-compose.yml     # Redis
├── package.json           # npm workspaces + scripts
└── README.md
```

---

## 8. Assumptions, shortcuts & trade-offs

- **DB choice:** SQLite (Node built-in) was chosen so there is no external DB to install. It supports the required CRUD and status updates. Swapping to Postgres/MySQL is straightforward (isolated queries in `email.service.ts` / `auth.service.ts`).
- **Redis persistence:** Redis is started with AOF (`--appendonly yes`) so queue state survives restarts. As an extra safety net, the app also recovers pending jobs from SQLite on boot.
- **Cancellation race:** if a job is already `processing` (being sent), it is not cancellable - only `scheduled` jobs can be cancelled. This is enforced in the API.
- **Retry semantics:** failures are retried up to 3 times with exponential backoff. If the worker crashes after `sendMail` succeeds but before the DB update, the job may be re-sent on recovery (a narrow at-least-once delivery trade-off).
- **Rate limiter:** a simple fixed 1-hour window (in DB) rather than a sliding window or Redis-backed bucket. It is per-user and covers scheduling only, not sending (sending is controlled by worker concurrency/limiter).
- **JSON transport fallback:** when no SMTP/Ethereal is available, messages are "sent" to a JSON transport (logged) so the demo remains fully functional offline.
- **Security defaults:** production should set a strong `JWT_SECRET` and a restrictive CORS origin. The dev config uses permissive CORS.
- **Email body type:** currently text/plain. HTML/html-editor support would be a natural next step.