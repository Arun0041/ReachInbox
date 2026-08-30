import { Queue } from 'bullmq';
import { env } from '../config/env';
import { createRedis } from '../config/redis';

export const EMAIL_QUEUE = 'emails';
export const EMAIL_JOB = 'send-email';

export type { EmailJobData } from '../types';

let queue: Queue | null = null;

export function getQueue(): Queue {
  if (!queue) {
    queue = new Queue(EMAIL_QUEUE, {
      connection: createRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
      },
    });
  }
  return queue;
}

export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}