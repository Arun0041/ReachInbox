import type { Knex } from 'knex';

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  google_id TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  password_hash TEXT,
  slack_access_token TEXT,
  slack_channel_id TEXT,
  slack_team_id TEXT,
  slack_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS senders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default sender',
  provider TEXT NOT NULL DEFAULT 'ethereal',
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_pass TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES senders(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  error TEXT,
  info TEXT,
  batch_id TEXT,
  hourly_limit INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE emails ADD COLUMN IF NOT EXISTS hourly_limit INTEGER;

CREATE INDEX IF NOT EXISTS idx_emails_user_schedule ON emails(user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_sender_status ON emails(sender_id, status);
CREATE INDEX IF NOT EXISTS idx_emails_batch ON emails(batch_id);

CREATE TABLE IF NOT EXISTS rate_limits (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  window_start BIGINT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, window_start)
);

CREATE TABLE IF NOT EXISTS rate_limit_hits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sender_id INTEGER REFERENCES senders(id) ON DELETE SET NULL,
  window_start BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS es_failures (
  id SERIAL PRIMARY KEY,
  email_id TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export async function applySchema(db: Knex): Promise<void> {
  // Postgres rejects multiple commands in a single prepared statement via Knex,
  // so apply each DDL statement on its own.
  const statements = SCHEMA_SQL.split(';').map((s) => s.trim()).filter(Boolean);
  for (const statement of statements) {
    await db.raw(statement);
  }
}