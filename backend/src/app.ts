import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import authRoutes from './routes/auth.routes';
import emailRoutes from './routes/email.routes';
import slackRoutes from './routes/slack.routes';
import senderRoutes from './routes/sender.routes';
import { notFound, errorHandler } from './middleware/errorHandler';
import { env, isDev } from './config/env';
import { getQueue } from './services/queue.service';

export function createApp(): express.Express {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  if (isDev) app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => {
    res.json({ data: { status: 'ok', uptime: process.uptime() } });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/emails', emailRoutes);
  app.use('/api/slack', slackRoutes);
  app.use('/api/senders', senderRoutes);

  // Live BullMQ dashboard
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  createBullBoard({
    queues: [new BullMQAdapter(getQueue())],
    serverAdapter,
  });
  app.use('/admin/queues', serverAdapter.getRouter());

  app.use(notFound);
  app.use(errorHandler);

  return app;
}