import { randomUUID } from 'node:crypto';
import type { Job } from 'bullmq';
import { getDb } from '../config/db';
import { env } from '../config/env';
import { getTransporterForSender, getFromAddress, getPreviewUrl } from '../config/email';
import { getSender, getOrCreateDefaultSender } from './sender.service';
import { consumeSenderRate, markNotifiedForWindow } from './rateLimit.service';
import { sendSlackNotification } from './slack.service';
import { indexEmail } from './elasticsearch.service';
import { AppError } from '../utils/AppError';
import type { Email, EmailStatus, User, ScheduleBatchInput } from '../types';
import { getQueue, EMAIL_JOB, type EmailJobData } from './queue.service';

export async function getEmailById(id: string): Promise<Email | undefined> {
  const db = getDb();
  const rows = await db.raw('SELECT * FROM emails WHERE id = ?', [id]);
  return (rows.rows as Email[])[0];
}

export async function listEmails(userId: number, statuses: EmailStatus[]): Promise<Email[]> {
  const db = getDb();
  const rows = await db('emails')
    .where('user_id', userId)
    .whereIn('status', statuses)
    .orderBy('scheduled_at', 'desc');
  return rows as Email[];
}

export async function scheduleEmails(input: ScheduleBatchInput): Promise<{ scheduled: number; batchId: string }> {
  const db = getDb();
  const batchId = randomUUID();
  const sender = input.senderId ? await getSender(input.senderId) : await getOrCreateDefaultSender(input.userId);
  if (!sender) throw new AppError(400, 'No sender available');
  const queue = getQueue();
  const startMs = new Date(input.startAt).getTime();
  if (Number.isNaN(startMs)) throw new AppError(400, 'Invalid start time');
  const delayBetween = Math.max(0, input.delayBetweenMs);

  let scheduled = 0;
  for (const [index, toEmail] of input.toEmails.entries()) {
    const id = randomUUID();
    const scheduledAtIso = new Date(startMs + index * delayBetween).toISOString();
    await db.raw(
      `INSERT INTO emails (id, user_id, sender_id, to_email, subject, body, scheduled_at, status, batch_id, hourly_limit, attempts)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, 0)`,
      [id, input.userId, sender.id, toEmail, input.subject, input.body, scheduledAtIso, batchId, input.hourlyLimit ?? null]
    );
    const delay = Math.max(0, new Date(scheduledAtIso).getTime() - Date.now());
    await queue.add(
      EMAIL_JOB,
      { emailId: id, userId: input.userId, senderId: sender.id, to: toEmail, subject: input.subject, body: input.body },
      { jobId: id, delay }
    );
    scheduled += 1;
  }

  console.log(`[schedule] queued ${scheduled} email(s) for user ${input.userId}`);
  return { scheduled, batchId };
}

export async function cancelEmail(userId: number, id: string): Promise<Email> {
  const email = await getEmailById(id);
  if (!email || email.user_id !== userId) throw new AppError(404, 'Email not found');
  if (email.status !== 'scheduled') throw new AppError(400, 'Only scheduled emails can be cancelled');
  const queue = getQueue();
  await queue.remove(id);
  const db = getDb();
  await db.raw(`UPDATE emails SET status = 'cancelled' WHERE id = ?`, [id]);
  const updated = await getEmailById(id);
  if (!updated) throw new AppError(500, 'Failed to cancel email');
  return updated;
}

export async function processEmailJob(job: Job<EmailJobData>, token: string): Promise<void> {
  const data = job.data;
  const email = await getEmailById(data.emailId);
  if (!email) throw new Error(`Email ${data.emailId} not found in database`);
  if (email.status === 'cancelled') return;

  const sender = (data.senderId ? await getSender(data.senderId) : undefined) ?? (await getOrCreateDefaultSender(data.userId));
  const rate = await consumeSenderRate(sender.id, email.hourly_limit ?? undefined);

  if (!rate.allowed) {
    // Do NOT drop or fail: reschedule this job into the next hour window.
    const shouldNotify = await markNotifiedForWindow(sender.id, rate.windowStart);
    if (shouldNotify) {
      const db = getDb();
      const userRows = await db.raw('SELECT * FROM users WHERE id = ?', [data.userId]);
      const user = (userRows.rows as User[])[0];
      if (user) {
        await sendSlackNotification(
          user,
          sender,
          `Hourly limit reached for sender ${sender.email}. Used ${rate.count}/${rate.limit} this hour; sends resume at ${new Date(rate.nextWindowAt).toISOString()}.`
        );
      }
    }
    const delay = Math.max(0, rate.nextWindowAt - Date.now());
    await job.moveToDelayed(delay, token);
    return;
  }

  const db = getDb();
  await db.raw(`UPDATE emails SET status = 'processing', attempts = attempts + 1 WHERE id = ?`, [email.id]);

  try {
    let messageId: string | null = null;
    let previewUrl: string | null = null;
    const fromStr = sender.email || getFromAddress();

    if (env.ETHEREAL === 'true') {
      const transporter = await getTransporterForSender(sender);
      const info = await transporter.sendMail({
        from: fromStr,
        to: data.to,
        subject: data.subject,
        text: data.body,
      });
      previewUrl = getPreviewUrl(info);
      messageId = info.messageId ?? null;
    } else {
      if (!env.BREVO_API_KEY) throw new Error('BREVO_API_KEY is missing in environment variables');
      
      let senderName = "ReachInbox";
      let senderEmail = fromStr;
      const fromMatch = fromStr.match(/^(.*)<(.+)>$/);
      if (fromMatch) {
        senderName = fromMatch[1].trim();
        senderEmail = fromMatch[2].trim();
      }

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': env.BREVO_API_KEY,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: data.to }],
          subject: data.subject,
          textContent: data.body,
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Brevo API Error: ${res.status} - ${errText}`);
      }
      
      const json = (await res.json()) as { messageId: string };
      messageId = json.messageId;
    }

    const sentAt = new Date().toISOString();
    const meta = JSON.stringify({ messageId, previewUrl });
    await db.raw(
      `UPDATE emails SET status = 'sent', sent_at = ?, error = NULL, info = ? WHERE id = ?`,
      [sentAt, meta, email.id]
    );
    await indexEmail({ ...email, status: 'sent', sent_at: sentAt, info: meta });
    console.log(`[worker] sent email "${data.subject}" to ${data.to}`);
  } catch (err) {
    await db.raw(`UPDATE emails SET status = 'failed', error = ? WHERE id = ?`, [(err as Error).message, email.id]);
    throw err;
  }
}