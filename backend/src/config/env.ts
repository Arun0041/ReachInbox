import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const emptyToUndefined = (v: unknown) => (v === '' || v === undefined ? undefined : v);
const bool = (d: boolean) => z.preprocess((v) => {
  if (v === undefined || v === '') return d;
  if (typeof v === 'boolean') return v;
  return v === 'true' || v === '1';
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  WORKER_MODE: z.enum(['server', 'worker', 'all']).default('all'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  JWT_SECRET: z.string().default('dev-secret-change-me'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  DATABASE_URL: z.preprocess(emptyToUndefined, z.string().optional()),
  DB_HOST: z.preprocess(emptyToUndefined, z.string().default('localhost')),
  DB_PORT: z.preprocess(emptyToUndefined, z.coerce.number().default(5432)),
  DB_NAME: z.preprocess(emptyToUndefined, z.string().default('reachinbox')),
  DB_USER: z.preprocess(emptyToUndefined, z.string().default('postgres')),
  DB_PASSWORD: z.preprocess(emptyToUndefined, z.string().default('postgres')),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  ES_ENABLED: bool(true),
  ES_URL: z.string().default('http://localhost:9200'),
  ES_INDEX: z.string().default('emails'),

  GOOGLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_AUTH_ENABLED: bool(true),

  SLACK_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  SLACK_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),

  ETHEREAL: z.enum(['true', 'false']).default('true'),
  BREVO_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_FROM: z.string().default('ReachInbox <no-reply@example.com>'),

  QUEUE_CONCURRENCY: z.coerce.number().default(2),
  MIN_EMAIL_DELAY_MS: z.coerce.number().default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(3600000),
  RATE_LIMIT_RESCHEDULE_MS: z.coerce.number().default(3600000),
  USER_SCHEDULE_RATE_LIMIT: z.coerce.number().default(500),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isDev = env.NODE_ENV === 'development';