import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env } from './env';
import { initSchema } from '../db/schema';

let db: DatabaseSync | null = null;

export function openDb(): DatabaseSync {
  const dir = path.dirname(path.resolve(env.DATABASE_PATH));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(env.DATABASE_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  initSchema(db);
  return db;
}

export function getDb(): DatabaseSync {
  if (!db) {
    openDb();
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}