import type { NextFunction, Request, Response } from 'express';
import { getDb } from '../config/db';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

const WINDOW_MS = 60 * 60 * 1000;

export function emailRateLimit(req: Request, _res: Response, next: NextFunction): void {
  if (!req.userId) {
    next(new AppError(401, 'Authentication required'));
    return;
  }
  const userId = req.userId;
  const now = Date.now();
  const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const db = getDb();
  db.prepare(
    `INSERT INTO rate_limits (user_id, window_start, count) VALUES (?, ?, 0)
     ON CONFLICT(user_id, window_start) DO UPDATE SET count = count + 1`
  ).run(userId, windowStart);
  const row = db
    .prepare(`SELECT count FROM rate_limits WHERE user_id = ? AND window_start = ?`)
    .get(userId, windowStart) as { count: number };
  if (row.count > env.USER_EMAIL_RATE_LIMIT) {
    next(
      new AppError(
        429,
        `Rate limit exceeded: maximum ${env.USER_EMAIL_RATE_LIMIT} emails per hour`
      )
    );
    return;
  }
  next();
}