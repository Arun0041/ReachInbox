import nodemailer from 'nodemailer';
import { env } from './env';

export type TransportMode = 'ethereal' | 'smtp' | 'json';

interface PreparedTransport {
  transporter: nodemailer.Transporter;
  mode: TransportMode;
}

let prepared: PreparedTransport | null = null;
let preparedPromise: Promise<PreparedTransport> | null = null;

async function buildTransport(): Promise<PreparedTransport> {
  if (env.ETHEREAL === 'true') {
    try {
      const account = await nodemailer.createTestAccount();
      console.log('[email] Using Ethereal test account:', account.user);
      const transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: account.user, pass: account.pass },
      });
      return { transporter, mode: 'ethereal' };
    } catch (err) {
      console.warn('[email] Ethereal unavailable, falling back:', (err as Error).message);
    }
  }

  if (env.SMTP_HOST && env.SMTP_PORT) {
    try {
      const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' } : undefined,
      });
      await transporter.verify();
      console.log(`[email] Using SMTP transport ${env.SMTP_HOST}:${env.SMTP_PORT}`);
      return { transporter, mode: 'smtp' };
    } catch (err) {
      console.warn('[email] SMTP unavailable, falling back:', (err as Error).message);
    }
  }

  console.warn('[email] No real transport configured; using JSON transport (messages are logged)');
  return { transporter: nodemailer.createTransport({ jsonTransport: true }), mode: 'json' };
}

export async function getTransporter(): Promise<nodemailer.Transporter> {
  if (!preparedPromise) preparedPromise = buildTransport();
  const result = await preparedPromise;
  prepared = result;
  return result.transporter;
}

export function getTransportMode(): TransportMode | null {
  return prepared?.mode ?? null;
}

export function getFromAddress(): string {
  return env.SMTP_FROM;
}

export function getPreviewUrl(info: nodemailer.SentMessageInfo): string | null {
  try {
    const fn = (nodemailer as unknown as { getTestMessageUrl?: (i: unknown) => string | null }).getTestMessageUrl;
    if (prepared?.mode === 'ethereal' && typeof fn === 'function') {
      return fn(info) ?? null;
    }
  } catch {
    // ignore
  }
  return null;
}