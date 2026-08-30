import type { Request, Response } from 'express';
import { z } from 'zod';
import { scheduleEmails, listEmails, cancelEmail } from '../services/email.service';
import { searchEmails } from '../services/elasticsearch.service';
import { AppError } from '../utils/AppError';
import { ok } from '../utils/http';

const scheduleSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(300),
  body: z.string().trim().min(1, 'Body is required').max(10000),
  toEmails: z.array(z.string().trim().email('Invalid recipient email')).min(1).max(10000),
  startAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid start time'),
  delayBetweenMs: z.coerce.number().min(0).default(0),
  hourlyLimit: z.coerce.number().positive().optional(),
  senderId: z.coerce.number().int().positive().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(),
    contentType: z.string().optional()
  })).optional()
});

export async function createEmails(req: Request, res: Response): Promise<void> {
  if (!req.userId) throw new AppError(401, 'Authentication required');
  const body = scheduleSchema.parse(req.body);
  const result = await scheduleEmails({
    userId: req.userId,
    senderId: body.senderId,
    toEmails: body.toEmails,
    subject: body.subject,
    body: body.body,
    startAt: body.startAt,
    delayBetweenMs: body.delayBetweenMs,
    hourlyLimit: body.hourlyLimit,
    attachments: body.attachments,
  });
  ok(res, result, 201);
}

export async function listScheduled(req: Request, res: Response): Promise<void> {
  if (!req.userId) throw new AppError(401, 'Authentication required');
  const emails = await listEmails(req.userId, ['scheduled', 'processing']);
  ok(res, { emails });
}

export async function listSent(req: Request, res: Response): Promise<void> {
  if (!req.userId) throw new AppError(401, 'Authentication required');
  const emails = await listEmails(req.userId, ['sent', 'failed']);
  ok(res, { emails });
}

export async function search(req: Request, res: Response): Promise<void> {
  if (!req.userId) throw new AppError(401, 'Authentication required');
  const q = String(req.query.q ?? '').trim();
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const emails = await searchEmails(req.userId, q, status);
  ok(res, { emails });
}

export async function cancelEmailRequest(req: Request, res: Response): Promise<void> {
  if (!req.userId) throw new AppError(401, 'Authentication required');
  const email = await cancelEmail(req.userId, req.params.id);
  ok(res, { email });
}