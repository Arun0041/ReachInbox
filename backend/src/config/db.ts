import knex, { Knex } from 'knex';
import { env } from './env';

let instance: Knex | null = null;

export function getDb(): Knex {
  if (!instance) {
    const connection =
      env.DATABASE_URL ??
      ({
        host: env.DB_HOST,
        port: env.DB_PORT,
        database: env.DB_NAME,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
      } as Knex.PgConnectionConfig);

    instance = knex({
      client: 'pg',
      connection,
      pool: { min: 1, max: 10 },
    });
  }
  return instance;
}

export async function assertDbAvailable(): Promise<void> {
  const db = getDb();
  try {
    await db.raw('SELECT 1');
  } catch (err) {
    throw new Error(
      'Cannot reach PostgreSQL. Start it with "docker compose up -d postgres".(' + (err as Error).message + ')'
    );
  }
}

export async function closeDb(): Promise<void> {
  if (instance) {
    await instance.destroy();
    instance = null;
  }
}