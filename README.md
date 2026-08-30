# ReachInbox – Full-stack Email Job Scheduler

A production-grade email scheduler + dashboard for **ReachInbox** (a product of **Outbox Labs**). Users log in with Google (or email/password), upload a list of leads, and schedule a batch of emails to be sent at a future time. A **BullMQ** worker (backed by **Redis**) picks up due jobs, sends each email through **Ethereal** (fake SMTP) or a real SMTP relay, and records the result in **PostgreSQL**. Scheduled and sent emails are searchable via **Elasticsearch**, and a live **Bull Board** shows real-time queue activity.

This is a "tiny slice" of the real ReachInbox system: reliable scheduling, persistent jobs, per-sender throttling, and rate-limit-aware rescheduling — with a clean React dashboard on top.

- **Backend:** Node.js, TypeScript, Express, BullMQ, Redis, PostgreSQL (Knex), Nodemailer + Ethereal, Elasticsearch, JWT auth, Google OAuth, Slack OAuth
- **Frontend:** React, TypeScript, Vite, React Router, Axios, Tailwind (CSS design system)
- **Infra:** Docker Compose (Redis with AOF, Postgres 16, Elasticsearch 8)

---

## 1. Features Implemented

### Backend

| Area | What it does |
| --- | --- |
| **Auth** | Email/password register + login (JWT, bcrypt) and **real Google OAuth** login (`/api/auth/google` → callback → SPA). |
| **Senders** | Multi-sender support. A default Ethereal sender is auto-created per user (`GET/POST /api/senders`). |
| **Scheduling** | `POST /api/emails` accepts a batch of recipients + `startAt` + `delayBetweenMs`. One BullMQ delayed job is created per recipient (no cron). |
| **BullMQ worker** | Configurable `QUEUE_CONCURRENCY`. `attempts: 3` with exponential backoff. |
| **Min delay (throttling)** | Worker-level `limiter { max: 1, duration: MIN_EMAIL_DELAY_MS }` enforces a minimum gap between individual sends. |
| **Hourly rate limit** | Redis atomic `INCR` per `sender:window` (`MAX_EMAILS_PER_HOUR_PER_SENDER`, or per-batch `hourlyLimit`). Safe across workers. |
| **Reschedule on limit** | When the hourly limit is hit the job is **moved to delayed** into the next window — never dropped or failed. |
| **Slack notification** | Real OAuth connect flow; on a rate-limit hit a live `chat.postMessage` is sent (idempotent per window, no crash if not connected, reconnect works without redeploy). |
| **Persistence / restart** | All emails live in Postgres; on boot `recoverPendingJobs()` re-enqueues `scheduled`/`processing` rows with remaining delay (`jobId = email.id`, so re-adds are idempotent). Redis runs with AOF. |
| **Search (Elasticsearch)** | Sent/scheduled emails are indexed into an ES index; `GET /api/emails/search?q=&status=` returns matches, with a Postgres `ILIKE` fallback. |
| **Live queue dashboard** | Bull Board mounted at `/admin/queues`. |
| **Cancellation** | `DELETE /api/emails/:id` removes a still-`scheduled` job from the queue and marks it `cancelled`. |
| **Health** | `GET /api/health`. |

### Frontend

| Area | What it does |
| --- | --- |
| **Login / Register** | Email/password forms with validation + loading states; Google "Continue with Google" button. |
| **Auth callback** | Consumes the Google OAuth token, stores it, refreshes the current user. |
| **Dashboard header** | ReachInbox brand, user avatar/name/email, **Connect Slack** button, logout. |
| **Compose New Email** | Subject, body, recipients textarea + **CSV/TXT upload** with live detected-email count, start time, delay-between, hourly limit → batch schedule API. |
| **Scheduled table** | Email, subject, scheduled time, status; loading + empty + error states; auto-refresh; **Cancel** with confirmation modal. |
| **Sent table** | Email, subject, sent time, status (`sent`/`failed`); loading + empty + error states; auto-refresh; Ethereal **Preview** link / copy message ID. |
| **Reusable UI kit** | `Button`, `Input`, `Textarea`, `Select`, `Modal`, `DataTable`, `Badge`, `EmptyState`, `Spinner`, `StatusBadge`, toasts. |
| **Typed API client** | Axios client with typed request/response models + centralized error handling. |

---

## 2. Architecture

### How scheduling works

1. The frontend posts a batch to `POST /api/emails`: `{ subject, body, toEmails[], startAt, delayBetweenMs, hourlyLimit?, senderId? }`.
2. The backend validates the payload and inserts **one row per recipient** into `emails` (`status = 'scheduled'`), computing `scheduled_at = startAt + index * delayBetweenMs`.
3. For each row it adds a **BullMQ delayed job** named `send-email` to the `emails` queue with `jobId = email.id` and `delay = scheduled_at - now`.
4. When a job's delay elapses, the worker picks it up, consumes a send slot from Redis, marks the row `processing`, and sends the email via Nodemailer.
5. On success the row becomes `sent` (with `info = { messageId, previewUrl }`) and is indexed into Elasticsearch. On failure it becomes `failed` and BullMQ retries (max 3 attempts).

BullMQ drives all timing internally with **delayed jobs — there is no cron anywhere** in the stack (no `node-cron`, no OS crontab).

### Persistence on restart

- The source of truth is Postgres. The BullMQ queue in Redis holds the live job state, and Redis is started with **AOF** (`--appendonly yes`) so job state survives a Redis restart.
- On boot the app calls `recoverPendingJobs()`, which scans every `emails` row with `status IN ('scheduled','processing')` and re-adds it to the queue with `jobId = email.id` and the **remaining delay** (`scheduled_at - now`).
- Because `jobId` is deterministic (the email row's UUID), BullMQ ignores a re-add if the job already exists. Any job that was lost (e.g. Redis volume was reset) is re-created, so future emails still send after a restart.
- **No email is sent twice** unless the worker crashes between a successful SMTP send and the DB write — a narrow at-least-once delivery window that is documented in trade-offs.

### Rate limiting & concurrency

- **Worker concurrency:** `QUEUE_CONCURRENCY` sets how many job processors run in parallel on the worker.
- **Minimum delay between sends:** the worker is created with `limiter: { max: 1, duration: MIN_EMAIL_DELAY_MS }` (default 2000 ms). At most one job is processed every `MIN_EMAIL_DELAY_MS`, mimicking a provider's per-message throttle.
- **Emails per hour (per sender):** each send calls `consumeSenderRate()`, which runs an atomic Redis Lua `INCR` on `rl:sender:<senderId>:<windowStart>`. The effective limit is `hourlyLimit` (per batch) or `MAX_EMAILS_PER_HOUR_PER_SENDER` (env). The counter is Redis-backed, not in-memory, so it is correct across multiple workers/instances.
- **When the hour limit is reached:** the job is **not** dropped or failed. It is moved back to delayed (`job.moveToDelayed(nextWindowAt)`), preserving order as much as BullMQ allows, and will be retried when the window resets.
- **Slack notification (live):** the first time a sender's limit is hit in a window, the worker fires a real Slack `chat.postMessage` via the user's stored OAuth token. A Redis key `slack:notified:<senderId>:<windowStart>` makes it fire at most once per window. If Slack is not connected, the send is skipped cleanly; connecting later works immediately (no redeploy).

### Behavior under load (1000+ simultaneous sends)

- Each recipient is its own BullMQ delayed job; they are all enqueued efficiently at schedule time, and the queue limiter naturally paces them.
- The worker's concurrency and its limiter bound simultaneous SMTP connections and in-flight sends.
- The per-sender hourly counter is a single atomic Redis INCR per send — cheap and race-free even at higher throughput.
- When the limit is exceeded the excess jobs go back to delayed instead of failing, so the system degrades gracefully under burst load (e.g. scheduling 1000 emails for the same minute with a 100/hr limit still sends all of them across the next windows, without manual retries).

---

## 3. Prerequisites

- **Node.js >= 20** (Node 22+ recommended)
- **npm >= 9**
- **Docker** + Docker Compose (recommended) for Redis, Postgres, and Elasticsearch. Alternatively, you can point env vars at locally running instances.
- Internet access to fetch Ethereal test accounts, Google OAuth, and Slack OAuth (only for those features).

---

## 4. Setup & Run

### 4.1 Start the infrastructure

```bash
docker compose up -d
```

This starts:

- **Redis** (port 6379, with AOF persistence)
- **PostgreSQL 16** (port 5432, db `reachinbox`, user/pass `postgres`)
- **Elasticsearch 8** (port 9200, single-node, security disabled)

> Elasticsearch on Linux hosts needs `vm.max_map_count` raised (`sysctl -w vm.max_map_count=262144`). Docker Desktop for macOS/Windows handles this for you.

### 4.2 Install dependencies

```bash
npm install
```

This installs both workspaces (`backend` and `frontend`) from the repo root.

### 4.3 Configure the backend

```bash
cd backend
cp .env.example .env
# edit values as needed
```

The default `.env.example` points at `localhost` for Postgres, Redis, and Elasticsearch and enables Ethereal.

### 4.4 Run the backend

#### Option A – server + worker in one process (simplest)

```bash
# from the repo root
npm run dev:server
```

With `WORKER_MODE=all` (default) the API and the BullMQ worker run in the same process.

#### Option B – server and worker as separate processes

```bash
# Terminal A – API only
npm --workspace backend run dev

# Terminal B – worker only
npm --workspace backend run dev:worker
```

When running the API on its own, set `WORKER_MODE=server` in `backend/.env` so the API does not start a worker.

#### All-in-one dev script

```bash
# from the repo root
npm run dev
```

Runs API + worker + frontend together with `concurrently`.

### 4.5 Run the frontend

```bash
# from the repo root
npm run dev:frontend
```

or

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server starts on `http://localhost:5173` and proxies `/api` to the backend on `http://localhost:5000`.

### 4.6 Live BullMQ dashboard

Once the server is running, open:

```
http://localhost:5000/admin/queues
```

This shows the `emails` queue, delayed/active/completed counts, and lets you inspect and re-drive jobs.

---

## 5. Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `5000` | API port |
| `WORKER_MODE` | `all` | `all` (API+worker), `server` (API only), `worker` (worker only) |
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin + OAuth redirect target |
| `JWT_SECRET` | `dev-secret-change-me` | JWT signing secret |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/reachinbox` | Postgres connection (or use the `DB_*` fields) |
| `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD` | `localhost/5432/reachinbox/postgres/postgres` | Postgres connection parts |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection for BullMQ + counters |
| `ES_ENABLED` | `true` | Enable Elasticsearch indexing/search |
| `ES_URL` | `http://localhost:9200` | Elasticsearch node |
| `ES_INDEX` | `emails` | Elasticsearch index name |
| `GOOGLE_CLIENT_ID/SECRET` | empty | Real Google OAuth credentials |
| `GOOGLE_REDIRECT_URI` | `http://localhost:5000/api/auth/google/callback` | Google OAuth callback |
| `SLACK_CLIENT_ID/SECRET` | empty | Real Slack OAuth credentials |
| `SLACK_REDIRECT_URI` | `http://localhost:5000/api/slack/callback` | Slack OAuth callback |
| `ETHEREAL` | `true` | Use Ethereal fake SMTP |
| `SMTP_HOST/PORT/USER/PASS` | empty | Optional real SMTP relay |
| `SMTP_FROM` | `ReachInbox <no-reply@example.com>` | Default from address |
| `QUEUE_CONCURRENCY` | `2` | BullMQ worker concurrency |
| `MIN_EMAIL_DELAY_MS` | `2000` | Minimum delay between individual sends |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `100` | Per-sender hourly send limit |
| `RATE_LIMIT_WINDOW_MS` | `3600000` | Owner window length (ms) for the hourly counter |
| `USER_SCHEDULE_RATE_LIMIT` | `500` | Max `POST /api/emails` calls per user per hour |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_URL` | `/api` | Backend base URL. Keep `/api` for the Vite dev proxy. |

---

## 6. Ethereal Email Setup

No manual setup is required — when `ETHEREAL=true`, the backend calls `nodemailer.createTestAccount()` on first send and creates a fresh Ethereal test inbox for that process. Every email is delivered to Ethereal's fake SMTP, and the Ethereal **preview URL** is stored in the `info` column and exposed in the Sent table (or you can grab it from the Bull Board / Sent preview link).

To inspect Ethereal credentials directly, they are logged at worker startup:

```
[email] Using Ethereal test account: xxxx@ethereal.email
```

---

## 7. Google OAuth Setup

1. Create a project at the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Google+ / OAuth APIs** and create **OAuth 2.0 Client ID** credentials (Web application).
3. Add the authorized redirect URI: `http://localhost:5000/api/auth/google/callback`.
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in `backend/.env`.
5. Restart the backend. The "Continue with Google" button on the login page now performs a real OAuth flow.

---

## 8. Slack Setup (rate-limit notifications)

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps).
2. Add the **OAuth & Permissions** redirect URI: `http://localhost:5000/api/slack/callback`.
3. Add the bot scopes `chat:write`, `im:write`, `users:read`, then install/approve the app so you get a client ID/secret and a bot token.
4. Set `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and `SLACK_REDIRECT_URI` in `backend/.env`.
5. Restart the backend. Click **Connect Slack** in the dashboard header; you'll be redirected through Slack's OAuth, and the backend stores the token per user.

The moment a sender hits its hourly limit, the worker sends a live Slack message to the connected user. If Slack is **not** connected, the notification is skipped silently (no crash). Connecting later enables notifications immediately — no redeploy.

---

## 9. API Reference

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | - | Register email/password, returns `{ user, token }` |
| `POST` | `/api/auth/login` | - | Login, returns `{ user, token }` |
| `GET` | `/api/auth/me` | Bearer | Current user |
| `GET` | `/api/auth/google` | - | Start Google OAuth redirect |
| `GET` | `/api/auth/google/callback` | - | Google OAuth callback → redirect to `/auth/callback?token=` |
| `POST` | `/api/emails` | Bearer | Schedule a batch of emails (rate-limited) |
| `GET` | `/api/emails/scheduled` | Bearer | List `scheduled`/`processing` emails |
| `GET` | `/api/emails/sent` | Bearer | List `sent`/`failed` emails |
| `GET` | `/api/emails/search` | Bearer | Search emails (`?q=&status=`) via Elasticsearch |
| `DELETE` | `/api/emails/:id` | Bearer | Cancel a scheduled email |
| `GET` | `/api/senders` | Bearer | List senders |
| `POST` | `/api/senders` | Bearer | Create a sender |
| `GET` | `/api/slack/connect` | Bearer | Returns Slack OAuth `authUrl` |
| `GET` | `/api/slack/callback` | - | Slack OAuth callback → stores token |
| `GET` | `/api/slack/status` | Bearer | Slack connection status |
| `POST` | `/api/slack/disconnect` | Bearer | Disconnect Slack |
| `GET` | `/api/health` | - | Health check |
| `GET` | `/admin/queues` | - | Live Bull Board |

### Example schedule request

```json
{
  "subject": "Meeting reminder",
  "body": "Hi, just a reminder about our meeting.",
  "toEmails": ["one@example.com", "two@example.com"],
  "startAt": "2026-08-30T12:00:00.000Z",
  "delayBetweenMs": 2000,
  "hourlyLimit": 100
}
```

Response:

```json
{
  "data": {
    "scheduled": 2,
    "batchId": "4c2b..."
  }
}
```

---

## 10. Project Structure

```
outbox-email-scheduler/
├── backend/
│   ├── src/
│   │   ├── config/          # env, db (Knex+pg), redis, email (Ethereal/SMTP)
│   │   ├── controllers/     # auth, email, google, sender, slack
│   │   ├── db/              # schema + migration
│   │   ├── middleware/      # auth, rate limit, error handler
│   │   ├── routes/          # auth, email, sender, slack
│   │   ├── services/        # auth, email, queue, rateLimit, scheduler, sender, slack, elasticsearch
│   │   ├── types/           # shared types
│   │   ├── utils/           # AppError, asyncHandler, http
│   │   ├── workers/         # BullMQ email worker
│   │   ├── app.ts           # Express app + Bull Board
│   │   └── index.ts         # bootstrap
│   └── .env.example
├── frontend/
│   └── src/
│       ├── api/             # typed API clients
│       ├── components/      # ui kit + layout
│       ├── context/         # Auth, Toast
│       ├── hooks/           # useApiData
│       ├── pages/           # Login, Register, AuthCallback, Dashboard, Compose, Scheduled, Sent
│       ├── routes/          # ProtectedRoute
│       ├── types/           # shared types
│       ├── utils/           # format helpers
│       └── App.tsx
├── docker-compose.yml       # Redis + Postgres + Elasticsearch
├── package.json             # npm workspaces + scripts
└── README.md
```

---

## 11. Demo Walkthrough (≤5 min video)

1. **Start infra** and both apps (`docker compose up -d`, `npm install`, `npm run dev`).
2. **Login** with Google (or register with email/password), land on the dashboard.
3. **Compose:** paste several recipients (or upload a CSV/TXT), set a start time a couple minutes in the future, set delay and hourly limit, hit Schedule. Note the detected email count.
4. **Scheduled tab:** show the scheduled emails with future times and `scheduled` status.
5. **Sent tab:** wait for the delay to elapse, refresh, and show emails move to `sent` with Ethereal **Preview** links.
6. **Restart scenario:** stop the server (`Ctrl+C`), start it again, and show a future email that was scheduled before the restart still goes out on time (check the Sent tab).
7. **Rate limit / Slack (bonus):** set `MAX_EMAILS_PER_HOUR_PER_SENDER` low (e.g. `3`), schedule a large batch, Connect Slack, and show the Slack message arriving the moment the limit is hit, while the remaining jobs move to delayed instead of failing.
8. **Search:** use `/api/emails/search` (or add a query param from the API) to show Elasticsearch-backed search.

---

## 12. Assumptions, Shortcuts & Trade-offs

- **DB choice:** Postgres via Knex satisfies the MySQL/Postgres requirement; queries are isolated in services so switching to MySQL is straightforward.
- **Min delay:** enforced with a worker-level BullMQ `limiter (max:1, duration)` rather than a per-worker sleep. It applies per worker, so multiple workers each throttle independently. This is a clean, correct pace limiter; under very high concurrency the limiter may add slight latency to the *whole* queue (not per sender).
- **Rate-limit rescheduling:** when the hourly limit is hit, the job moves to delayed at the start of the next hour window (`nextWindowAt`). Ordering is "as good as BullMQ gives" — jobs are not strictly FIFO across the move, but none are dropped.
- **Slack channel:** the notification uses the user's stored `slack_team_id` as the channel. For a real per-channel experience you'd prompt the user to pick a channel during OAuth; this is a noted simplification. The message is a real, verifiable `chat.postMessage` call.
- **Elasticsearch resilience:** ES is probed once at first use; if it's unavailable the app falls back to Postgres `ILIKE` and records failures to `es_failures`. If ES starts *later* in the same process, a restart is needed to re-enable it (documented trade-off).
- **At-least-once delivery:** if the worker crashes after `sendMail` succeeds but before the DB write, the restored job may re-send. A true exactly-once system needs a send-idempotency provider; the idempotent `jobId` prevents *duplicate enqueues*, not duplicate SMTP deliveries in that narrow crash window.
- **Cancel race:** only `scheduled` jobs are cancellable; a job already `processing` cannot be cancelled (enforced in the API).
- **Email body:** text/plain. HTML/rich-text editor would be a natural next step.
- **Frontend search UI:** the search API is exposed; a search box in the tables is a small additive improvement and is not currently wired into the UI.

---

## 13. Submission Notes

- **Repository:** private GitHub monorepo (`backend/` + `frontend/`). Grant access to **`Mitrajit`** and **`Yadav036`**.
- **Demo video:** ≤ 5 minutes, covering schedule → dashboard → restart-persistence → rate-limit/Slack.
- This `README` documents the run steps, env setup (Ethereal, Google, Slack), architecture (scheduling, persistence, rate-limiting, concurrency), feature mapping, and trade-offs.