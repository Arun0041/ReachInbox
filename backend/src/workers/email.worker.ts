import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'bullmq';
import { getDb, closeDb, assertDbAvailable } from '../config/db';
import { applySchema } from '../db/schema';
import { getRedis, createRedis, closeRedis } from '../config/redis';
import { env } from '../config/env';
import { EMAIL_QUEUE, closeQueue, type EmailJobData } from '../services/queue.service';
import { processEmailJob } from '../services/email.service';
import { recoverPendingJobs } from '../services/scheduler.service';

let worker: Worker<EmailJobData> | null = null;

export function startEmailWorker(): Worker<EmailJobData> {
  if (worker) return worker;
  worker = new Worker<EmailJobData>(
    EMAIL_QUEUE,
    async (job, token) => {
      await processEmailJob(job, token ?? '');
    },
    {
      connection: createRedis(),
      concurrency: env.QUEUE_CONCURRENCY,
      // Enforce a minimum delay between individual sends (provider throttling).
      // max=1 means at most one job is processed per `MIN_EMAIL_DELAY_MS`.
      limiter: { max: 1, duration: env.MIN_EMAIL_DELAY_MS },
    }
  );
  worker.on('completed', (job) => console.log(`[worker] job ${job.id} completed`));
  worker.on('failed', (job, err) => console.error(`[worker] job ${job?.id ?? '?'} failed: ${err.message}`));
  worker.on('error', (err) => console.error('[worker] worker error:', err.message));
  return worker;
}

export function stopEmailWorker(): Promise<void> {
  if (!worker) return Promise.resolve();
  return worker.close().then(() => {
    worker = null;
  });
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

async function runWorkerOnly(): Promise<void> {
  await assertDbAvailable();
  await applySchema(getDb());
  await getRedis().ping();
  startEmailWorker();
  await recoverPendingJobs();
  console.log(`[worker] email worker started (concurrency=${env.QUEUE_CONCURRENCY}, min delay=${env.MIN_EMAIL_DELAY_MS}ms)`);

  const shutdown = async (): Promise<void> => {
    console.log('\n[worker] shutting down...');
    await stopEmailWorker();
    await closeQueue();
    await closeRedis();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (isMain) {
  runWorkerOnly().catch((err) => {
    console.error('[worker] failed to start:', err);
    process.exit(1);
  });
}