import { Redis } from 'ioredis';
import { env } from './env';

let shared: Redis | null = null;

export function createRedis(): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export function getRedis(): Redis {
  if (!shared) {
    shared = createRedis();
    shared.on('error', (err) => console.error('[redis] connection error:', err.message));
    shared.on('ready', () => console.log('[redis] connected'));
  }
  return shared;
}

export async function assertRedisAvailable(): Promise<void> {
  const redis = getRedis();
  try {
    await redis.ping();
  } catch (err) {
    throw new Error(
      `Cannot reach Redis at ${env.REDIS_URL}. Start it with "docker compose up -d redis". (${(err as Error).message})`
    );
  }
}

export async function closeRedis(): Promise<void> {
  if (shared) {
    await shared.quit();
    shared = null;
  }
}