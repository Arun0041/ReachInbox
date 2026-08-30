import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';
import { getDb } from '../config/db';
import type { Email } from '../types';

let client: Client | null = null;
let pingOk = true;

export async function getEsClient(): Promise<Client | null> {
  if (!env.ES_ENABLED) return null;
  if (!pingOk) return null;
  if (!client) {
    client = new Client({ node: env.ES_URL });
    try {
      await client.ping();
    } catch (err) {
      console.warn('[es] unavailable, indexing/search disabled:', (err as Error).message);
      pingOk = false;
      client = null;
    }
  }
  return client;
}

async function recordFailure(emailId: string, error: string): Promise<void> {
  const db = getDb();
  await db.raw('INSERT INTO es_failures (email_id, error) VALUES (?, ?)', [emailId, error]);
}

export async function indexEmail(email: Email): Promise<void> {
  const es = await getEsClient();
  if (!es) return;
  try {
    await es.index({
      index: env.ES_INDEX,
      id: email.id,
      document: {
        emailId: email.id,
        userId: email.user_id,
        senderId: email.sender_id,
        to: email.to_email,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduled_at,
        sentAt: email.sent_at,
        createdAt: email.created_at,
      },
    });
  } catch (err) {
    console.warn('[es] index failed:', (err as Error).message);
    await recordFailure(email.id, (err as Error).message);
  }
}

export async function searchEmails(userId: number, q: string, status?: string): Promise<Email[]> {
  const es = await getEsClient();
  if (es && q.trim()) {
    try {
      const res = await es.search({
        index: env.ES_INDEX,
        query: {
          bool: {
            filter: [{ term: { userId } }, ...(status ? [{ term: { status } }] : [])],
            must: [{ multi_match: { query: q, fields: ['to', 'subject', 'body'] } }],
          },
        },
      });
      const hits = res.hits.hits as Array<{ _source?: { emailId?: string } }>;
      const ids = hits.map((h) => h._source?.emailId).filter(Boolean) as string[];
      if (ids.length === 0) return [];
      const db = getDb();
      const rows = await db.raw(`SELECT * FROM emails WHERE id = ANY(?)`, [ids]);
      return rows.rows as Email[];
    } catch (err) {
      console.warn('[es] search failed, falling back to DB:', (err as Error).message);
    }
  }
  // Fallback: Postgres ILIKE search
  const db = getDb();
  const rows = status
    ? await db.raw(
        `SELECT * FROM emails WHERE user_id = ? AND status = ? AND (to_email ILIKE ? OR subject ILIKE ? OR body ILIKE ?) ORDER BY scheduled_at DESC`,
        [userId, status, `%${q}%`, `%${q}%`, `%${q}%`]
      )
    : await db.raw(
        `SELECT * FROM emails WHERE user_id = ? AND (to_email ILIKE ? OR subject ILIKE ? OR body ILIKE ?) ORDER BY scheduled_at DESC`,
        [userId, `%${q}%`, `%${q}%`, `%${q}%`]
      );
  return rows.rows as Email[];
}