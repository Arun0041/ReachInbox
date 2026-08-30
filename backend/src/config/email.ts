import nodemailer from 'nodemailer';
import { env } from './env';
import type { Sender } from '../types';

const cache = new Map<string, Promise<nodemailer.Transporter>>();

async function buildEthereal(): Promise<nodemailer.Transporter> {
  const account = await nodemailer.createTestAccount();
  console.log('[email] Using Ethereal test account:', account.user);
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    connectionTimeout: 5000,
    socketTimeout: 5000,
    auth: { user: account.user, pass: account.pass },
  });
}

export async function getTransporterForSender(sender: Sender): Promise<nodemailer.Transporter> {
  if (sender.provider === 'smtp' && sender.smtp_host && sender.smtp_port) {
    return nodemailer.createTransport({
      host: sender.smtp_host,
      port: sender.smtp_port,
      secure: sender.smtp_port === 465,
      auth: sender.smtp_user ? { user: sender.smtp_user, pass: sender.smtp_pass ?? '' } : undefined,
    });
  }
  const key = 'ethereal';
  if (!cache.has(key)) {
    cache.set(
      key,
      buildEthereal().catch((err) => {
        console.warn('[email] Ethereal unavailable, using JSON transport:', (err as Error).message);
        cache.delete(key);
        return nodemailer.createTransport({ jsonTransport: true });
      })
    );
  }
  return cache.get(key) as Promise<nodemailer.Transporter>;
}

export function getFromAddress(): string {
  return env.SMTP_FROM;
}

export function getPreviewUrl(info: nodemailer.SentMessageInfo): string | null {
  try {
    const fn = (nodemailer as unknown as { getTestMessageUrl?: (i: unknown) => string | null }).getTestMessageUrl;
    if (typeof fn === 'function') return fn(info) ?? null;
  } catch {
    // ignore
  }
  return null;
}