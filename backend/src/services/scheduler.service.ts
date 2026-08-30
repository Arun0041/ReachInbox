import { getDb } from '../config/db';
import type { Email } from '../types';
import { getQueue, EMAIL_JOB, type EmailJobData } from './queue.service';

function toJobData(email: Email): EmailJobData {
  return {
    emailId: email.id,
    userId: email.user_id,
    to: email.to_email,
    subject: email.subject,
    body: email.body,
  };
}

export async function recoverPendingJobs(): Promise<void> {
  const db = getDb();
  const pending = db
    .prepare(`SELECT * FROM emails WHERE status IN ('scheduled', 'processing')`)
    .all() as unknown as Email[];

  if (pending.length === 0) return;

  const queue = getQueue();
  let recovered = 0;
  for (const email of pending) {
    const delay = Math.max(0, new Date(email.scheduled_at).getTime() - Date.now());
    await queue.add(EMAIL_JOB, toJobData(email), { jobId: email.id, delay });
    recovered += 1;
  }
  console.log(`[scheduler] recovered ${recovered} pending email job(s)`);
}