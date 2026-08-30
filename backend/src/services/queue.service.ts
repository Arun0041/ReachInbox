import { Queue } from 'bullmq';
import { env } from '../config/env';
import { createRedis } from '../config/redis';

export const EMAIL_QUEUE = 'emails';
export const EMAIL_JOB = 'send-email';

export interface EmailJobData {
  emailId: string;
  userId: number;
  to: string;
  subject: string;
  body: string;
}

let queue: Queue<EmailJobData> | null = null;

export function getQueue(): Queue<EmailJobData> {
  if (!queue) {
    queue = new Queue<EmailJobData>(EMAIL_QUEUE, {
      connection: createRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
      },
      limiter: { max: env.QUEUE_RATE_LIMIT_MAX, duration: env.QUEUE_RATE_LIMIT_MS },
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