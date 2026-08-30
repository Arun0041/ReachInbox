import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';

export function notFound(req: Request, res: Response): void {
  res.status(404).json({ error: { message: `Route ${req.method} ${req.originalUrl} not found` } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: { message: 'Validation failed', issues: err.issues } });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: { message: 'Internal server error' } });
}