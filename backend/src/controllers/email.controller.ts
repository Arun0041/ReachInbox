import type { Request, Response } from 'express';
import { z } from 'zod';
import { scheduleEmail, listEmails, cancelEmail } from '../services/email.service';
import { AppError } from '../utils/AppError';
import { ok } from '../utils/http';

const scheduleSchema = z.object({
  to: z.string().trim().email('Valid recipient email required'),
  subject: z.string().trim().min(1, 'Subject is required').max(200),
  body: z.string().trim().min(1, 'Body is required').max(10000),
  scheduledAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid scheduled time'),
});

export async function createEmail(req: Request, res: Response): Promise<void> {
  if (!req.userId) throw new AppError(401, 'Authentication required');
  const body = scheduleSchema.parse(req.body);
  const email = await scheduleEmail({ userId: req.userId, ...body });
  ok(res, { email }, 201);
}

export function listScheduled(req: Request, res: Response): void {
  if (!req.userId) throw new AppError(401, 'Authentication required');
  const emails = listEmails(req.userId, 'scheduled');
  ok(res, { emails });
}

export function listSent(req: Request, res: Response): void {
  if (!req.userId) throw new AppError(401, 'Authentication required');
  const emails = listEmails(req.userId, 'sent');
  ok(res, { emails });
}

export async function cancelEmailRequest(req: Request, res: Response): Promise<void> {
  if (!req.userId) throw new AppError(401, 'Authentication required');
  const email = await cancelEmail(req.userId, req.params.id);
  ok(res, { email });
}