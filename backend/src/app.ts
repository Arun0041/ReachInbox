import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes';
import emailRoutes from './routes/email.routes';
import { notFound, errorHandler } from './middleware/errorHandler';
import { isDev } from './config/env';

export function createApp(): express.Express {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  if (isDev) app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => {
    res.json({ data: { status: 'ok', uptime: process.uptime() } });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/emails', emailRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}