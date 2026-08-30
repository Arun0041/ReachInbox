import type { NextFunction, Request, Response } from 'express';
import { getDb } from '../config/db';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

const WINDOW_MS = 60 * 60 * 1000;

export async function emailRateLimit(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    next(new AppError(401, 'Authentication required'));
    return;
  }
  const userId = req.userId;
  const now = Date.now();
  const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const db = getDb();
  const rows = await db.raw(
    `INSERT INTO rate_limits (user_id, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT (user_id, window_start) DO UPDATE SET count = rate_limits.count + 1
     RETURNING count`,
    [userId, windowStart]
  );
  const count = (rows.rows[0]?.count ?? 1) as number;
  if (count > env.USER_SCHEDULE_RATE_LIMIT) {
    next(new AppError(429, `Rate limit exceeded: maximum ${env.USER_SCHEDULE_RATE_LIMIT} schedule requests per hour`));
    return;
  }
  next();
}