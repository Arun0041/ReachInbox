import type { Request, Response } from 'express';
import { z } from 'zod';
import { registerUser, loginUser, signToken } from '../services/auth.service';
import { getDb } from '../config/db';
import { AppError } from '../utils/AppError';
import { ok } from '../utils/http';
import type { User } from '../types';

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().trim().email('Valid email required'),
  password: z.string().min(1, 'Password is required'),
});

export async function register(req: Request, res: Response): Promise<void> {
  const body = registerSchema.parse(req.body);
  const user = await registerUser(body);
  const token = signToken(user);
  ok(res, { user, token }, 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = loginSchema.parse(req.body);
  const user = await loginUser(body);
  const token = signToken(user);
  ok(res, { user, token });
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.userId) throw new AppError(401, 'Authentication required');
  const db = getDb();
  const rows = await db.raw('SELECT id, google_id, email, name, avatar_url, created_at FROM users WHERE id = ?', [req.userId]);
  const user = (rows.rows as User[])[0];
  if (!user) throw new AppError(404, 'User not found');
  ok(res, { user });
}