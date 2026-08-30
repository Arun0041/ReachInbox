import { openDb, closeDb } from './config/db';
import { env } from './config/env';
import { closeRedis, assertRedisAvailable } from './config/redis';
import { createApp } from './app';
import { recoverPendingJobs } from './services/scheduler.service';
import { closeQueue } from './services/queue.service';
import { startEmailWorker, stopEmailWorker } from './workers/email.worker';

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[server] ${signal} received, shutting down...`);
  if (env.WORKER_MODE !== 'server') await stopEmailWorker();
  await closeQueue();
  await closeRedis();
  closeDb();
  process.exit(0);
}

async function bootstrap(): Promise<void> {
  openDb();
  await assertRedisAvailable();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`[server] API listening on http://localhost:${env.PORT}`);
  });

  if (env.WORKER_MODE !== 'server') {
    startEmailWorker();
  }

  await recoverPendingJobs();

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  server.on('error', (err) => {
    console.error('[server] server error:', err);
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});