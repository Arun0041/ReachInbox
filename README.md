# ReachInbox - Full-stack Email Job Scheduler

A production-grade email scheduler + dashboard for **ReachInbox**. Users log in with Google (or email/password), upload a list of leads (or type them in with Gmail-style smart pills), and schedule a batch of emails to be sent at a future time. A **BullMQ** worker (backed by **Upstash Redis**) picks up due jobs, sends each email through **Brevo API** (with a smart automatic fallback to **Ethereal** testing SMTP if IP is restricted), and records the result in a **Neon Serverless PostgreSQL** database. 

This project demonstrates reliable scheduling, persistent jobs, per-sender throttling, file attachments, rich-text WYSIWYG editing, and rate-limit-aware rescheduling — with a clean React dashboard on top matched exactly to provided Figma designs.

## Tech Stack & Architecture

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router (Deployed on **Vercel**)
- **Backend:** Node.js, Express, TypeScript, Zod, Knex, PostgreSQL (Deployed on **Render**)
- **Database:** PostgreSQL (Hosted on **Neon**)
- **Queue/Worker:** BullMQ & Redis (Hosted on **Upstash**)
- **Email Providers:** Brevo (Primary API) + Nodemailer/Ethereal (Automatic Fallback)
- **Auth:** JWT, Google OAuth, Slack OAuth

---

## 1. Key Features

### Compose & Editor UI
- **Rich-Text Editor (WYSIWYG):** Fully native `contentEditable` editor allowing Bold, Italic, Underlining, Lists, Blockquotes, Images, Links, and Alignments. Toolbar buttons dynamically highlight based on cursor position.
- **File Attachments:** Users can attach multiple files natively. The files are converted to Base64, passed to the backend, and dispatched as real email attachments to the recipient via both Brevo and Ethereal.
- **Gmail-Style Recipient Pills:** Entering email addresses via space, comma, or enter converts the raw text into distinct, deletable visual "pills", exactly like Gmail.
- **Immediate vs Scheduled Send:** Dedicated "Send" button for instant dispatch, alongside "Send Later" popover.
- **CSV/TXT Bulk Upload:** Uploading a CSV automatically parses and extracts all valid email addresses.

### Email Viewing UI (Figma-Matched)
- **Full-Screen View:** Clicking a Sent or Scheduled email slides open a beautifully designed, full-screen email view matching the exact Figma mockups.
- **Interactive Action Icons:** Star, Archive, and Delete icons are wired up natively to state and backend controllers. 
- **Ethereal Fallback Previews:** Even if the Brevo IP gets temporarily blocked, the app catches it seamlessly, routes through Ethereal, and provides a direct "View on Ethereal" link inside the email view.

### Backend Infrastructure
- **Throttling & Hourly Limits:** Emails are staggered precisely according to `delayBetweenMs`. A Redis atomic counter strictly enforces hourly sender limits (e.g., max 100 emails an hour). 
- **Smart Rescheduling:** If the hourly limit is hit, the job is **not dropped**; instead, it is safely moved to "delayed" until the start of the next hour window.
- **Slack Integrations:** Real OAuth connect flow. When a rate-limit is hit, a live `chat.postMessage` alerts the user in Slack immediately.
- **Job Persistence:** All queue states are persisted in Postgres. On server restart, `recoverPendingJobs()` safely restores any interrupted tasks.

---

## 2. Environment Variables

### Backend (`backend/.env`)
```env
PORT=5000
DATABASE_URL=postgresql://user:password@ep-neon-host.neon.tech/neondb?sslmode=require
REDIS_URL=rediss://default:password@upstash-host.upstash.io:6379
JWT_SECRET=your_jwt_secret
FRONTEND_URL=https://reach-inbox-frontend-pi.vercel.app
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_secret
GOOGLE_REDIRECT_URI=https://reachinbox-x4i3.onrender.com/api/auth/google/callback
SLACK_CLIENT_ID=your_slack_id
SLACK_CLIENT_SECRET=your_slack_secret
SLACK_REDIRECT_URI=https://reachinbox-x4i3.onrender.com/api/slack/callback
BREVO_API_KEY=your_brevo_api_key
ETHEREAL=true
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=https://reachinbox-x4i3.onrender.com/api
```

---

## 3. Local Development

This project does **not** rely on Docker. Both the DB and Redis are hosted externally (Neon/Upstash).

### Backend Setup
1. `cd backend`
2. `npm install`
3. Set your `.env` variables
4. Run migrations: `npx tsx src/db/migrate.ts`
5. Start the server: `npm run dev`
*(The backend will start on port 5000 and connect to the Neon DB and Upstash Redis).*

### Frontend Setup
1. `cd frontend`
2. `npm install`
3. Set your `.env` variables
4. Start the dev server: `npm run dev`
*(The frontend will start on port 5173).*

---

## 4. API Reference

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | - | Register email/password, returns `{ user, token }` |
| `POST` | `/api/auth/login` | - | Login, returns `{ user, token }` |
| `GET` | `/api/auth/google` | - | Start Google OAuth redirect |
| `GET` | `/api/auth/google/callback` | - | Google OAuth callback |
| `POST` | `/api/emails` | Bearer | Schedule a batch of emails (attachments included) |
| `GET` | `/api/emails/scheduled` | Bearer | List `scheduled`/`processing` emails |
| `GET` | `/api/emails/sent` | Bearer | List `sent`/`failed` emails |
| `DELETE` | `/api/emails/:id` | Bearer | Cancel a scheduled email |
| `GET` | `/api/slack/connect` | Bearer | Returns Slack OAuth `authUrl` |
| `GET` | `/api/slack/callback` | - | Slack OAuth callback — stores token |
| `GET` | `/api/slack/status` | Bearer | Slack connection status |

---

## 5. Deployment Notes

### Frontend (Vercel)
The frontend uses standard Vite configuration deployed on Vercel. 
- A `vercel.json` rewrite rule is applied to prevent SPA 404 "Deployment Not Found" errors on page reloads.

### Backend (Render)
Deployed as a Web Service on Render. 
- Render uses load balancers which terminate SSL. The express app is configured with `app.set('trust proxy', 1)` to ensure that Google and Slack OAuth callback URIs correctly generate as `https://` instead of `http://`, preventing `redirect_uri_mismatch` errors.
- **Brevo API IP Restriction:** Render uses dynamic IP addresses. Brevo's default security rules block unrecognized IPs. To guarantee a functional demonstration, the email worker intelligently catches `401 Unauthorized IP` rejections from Brevo, logs a warning, and automatically fails over to the Ethereal SMTP fallback, ensuring the user's dashboard correctly displays "Sent" with a preview link.