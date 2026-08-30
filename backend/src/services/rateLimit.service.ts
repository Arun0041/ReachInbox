import { getRedis } from '../config/redis';
import { env } from '../config/env';

export interface SenderRateResult {
  allowed: boolean;
  count: number;
  limit: number;
  windowStart: number;
  nextWindowAt: number;
}

const CONSUME_SCRIPT = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return c
`;

export async function consumeSenderRate(senderId: number, limit?: number): Promise<SenderRateResult> {
  const effectiveLimit = limit && limit > 0 ? limit : env.MAX_EMAILS_PER_HOUR_PER_SENDER;
  const now = Date.now();
  const windowStart = Math.floor(now / env.RATE_LIMIT_WINDOW_MS) * env.RATE_LIMIT_WINDOW_MS;
  const key = `rl:sender:${senderId}:${windowStart}`;
  const ttl = Math.max(1, Math.floor((windowStart + env.RATE_LIMIT_WINDOW_MS - now) / 1000)) + 300;
  const redis = getRedis();
  const count = await redis.eval(CONSUME_SCRIPT, 1, key, String(ttl)) as number;
  return {
    allowed: count <= effectiveLimit,
    count,
    limit: effectiveLimit,
    windowStart,
    nextWindowAt: windowStart + env.RATE_LIMIT_WINDOW_MS,
  };
}

export async function markNotifiedForWindow(senderId: number, windowStart: number): Promise<boolean> {
  const redis = getRedis();
  const key = `slack:notified:${senderId}:${windowStart}`;
  const ttl = Math.max(1, Math.floor((windowStart + env.RATE_LIMIT_WINDOW_MS - Date.now()) / 1000)) + 300;
  // Atomic `SET NX`: returns 'OK' only if this window was not already notified,
  // so across multiple workers we fire the Slack notification exactly once.
  const result = await redis.set(key, '1', 'EX', ttl, 'NX');
  return result === 'OK';
}