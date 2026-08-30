import { randomUUID } from 'node:crypto';
import { getDb } from '../config/db';
import { getTransporter, getFromAddress, getPreviewUrl } from '../config/email';
import { AppError } from '../utils/AppError';
import type { Email, EmailStatus } from '../types';
import { getQueue, EMAIL_JOB, type EmailJobData } from './queue.service';

export interface ScheduleEmailInput {
  userId: number;
  to: string;
  subject: string;
  body: string;
  scheduledAt: string;
}

export function getEmailById(id: string): Email | undefined {
  const db = getDb();
  return db.prepare(`SELECT * FROM emails WHERE id = ?`).get(id) as unknown as Email | undefined;
}

export function listEmails(userId: number, status: EmailStatus): Email[] {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM emails WHERE user_id = ? AND status = ? ORDER BY scheduled_at DESC`)
    .all(userId, status) as unknown as Email[];
}

export async function scheduleEmail(input: ScheduleEmailInput): Promise<Email> {
  const id = randomUUID();
  const db = getDb();
  db.prepare(
    `INSERT INTO emails (id, user_id, to_email, subject, body, scheduled_at, status, attempts)
     VALUES (?, ?, ?, ?, ?, ?, 'scheduled', 0)`
  ).run(id, input.userId, input.to, input.subject, input.body, input.scheduledAt);

  const email = getEmailById(id);
  if (!email) throw new AppError(500, 'Failed to create email');

  const delay = Math.max(0, new Date(input.scheduledAt).getTime() - Date.now());
  const queue = getQueue();
  await queue.add(
    EMAIL_JOB,
    { emailId: id, userId: input.userId, to: input.to, subject: input.subject, body: input.body },
    { jobId: id, delay }
  );

  return email;
}

export async function cancelEmail(userId: number, id: string): Promise<Email> {
  const email = getEmailById(id);
  if (!email || email.user_id !== userId) throw new AppError(404, 'Email not found');
  if (email.status !== 'scheduled') {
    throw new AppError(400, 'Only scheduled emails can be cancelled');
  }
  const queue = getQueue();
  await queue.remove(id);
  getDb().prepare(`UPDATE emails SET status = 'cancelled' WHERE id = ?`).run(id);
  const updated = getEmailById(id);
  if (!updated) throw new AppError(500, 'Failed to cancel email');
  return updated;
}

export async function processEmailJob(data: EmailJobData): Promise<void> {
  const db = getDb();
  const email = getEmailById(data.emailId);
  if (!email) throw new Error(`Email ${data.emailId} not found in database`);

  if (email.status === 'cancelled') return;

  db.prepare(`UPDATE emails SET status = 'processing', attempts = attempts + 1 WHERE id = ?`).run(email.id);

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to: data.to,
      subject: data.subject,
      text: data.body,
    });
    const previewUrl = getPreviewUrl(info);
    const meta = JSON.stringify({ messageId: info.messageId ?? null, previewUrl });
    db.prepare(
      `UPDATE emails SET status = 'sent', sent_at = ?, error = NULL, info = ? WHERE id = ?`
    ).run(new Date().toISOString(), meta, email.id);
    console.log(`[worker] sent email "${data.subject}" to ${data.to}`);
  } catch (err) {
    db.prepare(`UPDATE emails SET status = 'failed', error = ? WHERE id = ?`).run((err as Error).message, email.id);
    throw err;
  }
}