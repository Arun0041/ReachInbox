import { getDb } from '../config/db';
import type { Sender } from '../types';

export async function listSenders(userId: number): Promise<Sender[]> {
  const db = getDb();
  const rows = await db.raw('SELECT * FROM senders WHERE user_id = ? ORDER BY id', [userId]);
  return rows.rows as Sender[];
}

export async function getSender(id: number): Promise<Sender | undefined> {
  const db = getDb();
  const rows = await db.raw('SELECT * FROM senders WHERE id = ?', [id]);
  return (rows.rows as Sender[])[0];
}

export async function getOrCreateDefaultSender(userId: number): Promise<Sender> {
  const db = getDb();
  const rows = await db.raw('SELECT * FROM senders WHERE user_id = ? ORDER BY id LIMIT 1', [userId]);
  const existing = (rows.rows as Sender[])[0];
  if (existing) return existing;
  const inserted = await db.raw(
    `INSERT INTO senders (user_id, email, name, provider, active) VALUES (?, ?, 'Default sender', 'ethereal', true)
     RETURNING id, user_id, email, name, provider, smtp_host, smtp_port, smtp_user, smtp_pass, active, created_at`,
    [userId, 'default@reachinbox.test']
  );
  return (inserted.rows as Sender[])[0];
}

export async function createSender(userId: number, input: Partial<Sender>): Promise<Sender> {
  const db = getDb();
  const rows = await db.raw(
    `INSERT INTO senders (user_id, email, name, provider, smtp_host, smtp_port, smtp_user, smtp_pass, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, true)
     RETURNING id, user_id, email, name, provider, smtp_host, smtp_port, smtp_user, smtp_pass, active, created_at`,
    [userId, input.email ?? 'sender@reachinbox.test', input.name ?? 'Sender', input.provider ?? 'ethereal', input.smtp_host ?? null, input.smtp_port ?? null, input.smtp_user ?? null, input.smtp_pass ?? null]
  );
  return (rows.rows as Sender[])[0];
}