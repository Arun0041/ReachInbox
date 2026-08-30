import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const emptyToUndefined = (v: unknown) => (v === '' || v === undefined ? undefined : v);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  WORKER_MODE: z.enum(['server', 'worker', 'all']).default('all'),
  JWT_SECRET: z.string().default('dev-secret-change-me'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  DATABASE_PATH: z.string().default('./data/outbox.db'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ETHEREAL: z.enum(['true', 'false']).default('true'),
  SMTP_HOST: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PORT: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
  SMTP_USER: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PASS: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_FROM: z.string().default('Email Scheduler <no-reply@example.com>'),
  QUEUE_CONCURRENCY: z.coerce.number().default(2),
  QUEUE_RATE_LIMIT_MAX: z.coerce.number().default(10),
  QUEUE_RATE_LIMIT_MS: z.coerce.number().default(1000),
  USER_EMAIL_RATE_LIMIT: z.coerce.number().default(50),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isDev = env.NODE_ENV === 'development';