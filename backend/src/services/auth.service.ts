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
  return {
    id: user.id,
    google_id: user.google_id ?? null,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url ?? null,
    created_at: user.created_at,
  };
}

export async function registerUser(input: { name: string; email: string; password: string }): Promise<User> {
  const db = getDb();
  const existing = await db.raw('SELECT id FROM users WHERE email = ?', [input.email]);
  if (existing.rows.length > 0) throw new AppError(409, 'An account with this email already exists');
  const hash = await bcrypt.hash(input.password, 10);
  const inserted = await db.raw(
    `INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)
     RETURNING id, google_id, email, name, avatar_url, created_at`,
    [input.email, hash, input.name]
  );
  return toPublicUser(inserted.rows[0] as User);
}

export async function loginUser(input: { email: string; password: string }): Promise<User> {
  const db = getDb();
  const rows = await db.raw('SELECT * FROM users WHERE email = ?', [input.email]);
  const user = rows.rows[0] as User | undefined;
  if (!user || !user.password_hash) throw new AppError(401, 'Invalid email or password');
  const valid = await bcrypt.compare(input.password, user.password_hash);
  if (!valid) throw new AppError(401, 'Invalid email or password');
  return toPublicUser(user);
}

export async function findOrCreateGoogleUser(profile: {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}): Promise<User> {
  const db = getDb();
  const byGoogle = await db.raw('SELECT * FROM users WHERE google_id = ?', [profile.sub]);
  if (byGoogle.rows[0]) return toPublicUser(byGoogle.rows[0] as User);

  const byEmail = await db.raw('SELECT * FROM users WHERE email = ?', [profile.email]);
  if (byEmail.rows[0]) {
    const updated = await db.raw(
      'UPDATE users SET google_id = ?, name = ?, avatar_url = ? WHERE id = ? RETURNING id, google_id, email, name, avatar_url, created_at',
      [profile.sub, profile.name, profile.picture ?? null, byEmail.rows[0].id]
    );
    return toPublicUser(updated.rows[0] as User);
  }

  const inserted = await db.raw(
    `INSERT INTO users (google_id, email, name, avatar_url) VALUES (?, ?, ?, ?)
     RETURNING id, google_id, email, name, avatar_url, created_at`,
    [profile.sub, profile.email, profile.name, profile.picture ?? null]
  );
  return toPublicUser(inserted.rows[0] as User);
}