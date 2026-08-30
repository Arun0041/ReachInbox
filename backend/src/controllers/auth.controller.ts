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

export function me(req: Request, res: Response): void {
  const db = getDb();
  const user = db
    .prepare(`SELECT id, email, name, created_at FROM users WHERE id = ?`)
    .get(req.userId) as User | undefined;
  if (!user) throw new AppError(404, 'User not found');
  ok(res, { user });
}