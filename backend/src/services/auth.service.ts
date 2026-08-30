import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../config/db';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import type { User } from '../types';

export function signToken(user: User): string {
  return jwt.sign({ userId: user.id, email: user.email }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function toPublicUser(user: User): User {
  return { id: user.id, email: user.email, name: user.name, created_at: user.created_at };
}

export async function registerUser(input: { name: string; email: string; password: string }): Promise<User> {
  const db = getDb();
  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(input.email);
  if (existing) throw new AppError(409, 'An account with this email already exists');
  const hash = await bcrypt.hash(input.password, 10);
  const result = db
    .prepare(`INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)`)
    .run(input.email, hash, input.name);
  const user = db
    .prepare(`SELECT id, email, name, created_at FROM users WHERE id = ?`)
    .get(Number(result.lastInsertRowid)) as User;
  return toPublicUser(user);
}

export async function loginUser(input: { email: string; password: string }): Promise<User> {
  const db = getDb();
  const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(input.email) as User | undefined;
  if (!user) throw new AppError(401, 'Invalid email or password');
  const valid = await bcrypt.compare(input.password, user.password_hash ?? '');
  if (!valid) throw new AppError(401, 'Invalid email or password');
  return toPublicUser(user);
}