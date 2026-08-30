import type { Request, Response } from 'express';
import { z } from 'zod';
import { listSenders, createSender } from '../services/sender.service';
import { AppError } from '../utils/AppError';
import { ok } from '../utils/http';

const createSenderSchema = z.object({
  email: z.string().trim().email('Valid email required'),
  name: z.string().trim().min(1).max(120),
  provider: z.enum(['ethereal', 'smtp']).default('ethereal'),
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
});

export async function getSenders(req: Request, res: Response): Promise<void> {
  if (!req.userId) throw new AppError(401, 'Authentication required');
  const senders = await listSenders(req.userId);
  ok(res, { senders });
}

export async function createSenderRequest(req: Request, res: Response): Promise<void> {
  if (!req.userId) throw new AppError(401, 'Authentication required');
  const body = createSenderSchema.parse(req.body);
  const sender = await createSender(req.userId, {
    email: body.email,
    name: body.name,
    provider: body.provider,
    smtp_host: body.smtpHost,
    smtp_port: body.smtpPort,
    smtp_user: body.smtpUser,
    smtp_pass: body.smtpPass,
  });
  ok(res, { sender }, 201);
}