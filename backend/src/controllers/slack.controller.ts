import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { getDb } from '../config/db';
import { exchangeSlackCode, saveSlackConnection, disconnectSlack } from '../services/slack.service';
import { AppError } from '../utils/AppError';
import { ok } from '../utils/http';
import type { User } from '../types';

export function slackConnectStart(req: Request, res: Response): void {
  if (!req.userId) throw new AppError(401, 'Authentication required');
  if (!env.SLACK_CLIENT_ID) throw new AppError(500, 'Slack OAuth is not configured');
  const state = jwt.sign({ userId: req.userId, purpose: 'slack' }, env.JWT_SECRET, { expiresIn: '10m' });
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.searchParams.set('client_id', env.SLACK_CLIENT_ID);
  url.searchParams.set('scope', 'chat:write,im:write,users:read');
  url.searchParams.set('state', state);
  ok(res, { authUrl: url.toString() });
}

export async function slackCallback(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  if (!code || !state) throw new AppError(400, 'Missing code or state');
  let userId: number;
  try {
    const payload = jwt.verify(state, env.JWT_SECRET) as { userId?: number; purpose?: string };
    if (payload.purpose !== 'slack' || !payload.userId) throw new Error('bad state');
    userId = payload.userId;
  } catch {
    throw new AppError(401, 'Invalid OAuth state');
  }
  const tokens = await exchangeSlackCode(code);
  await saveSlackConnection(userId, tokens);
  res.redirect(`${env.FRONTEND_URL}/settings?slack=connected`);
}

export async function slackStatus(req: Request, res: Response): Promise<void> {
  if (!req.userId) throw new AppError(401, 'Authentication required');
  const db = getDb();
  const rows = await db.raw('SELECT slack_access_token, slack_team_id, slack_channel_id, slack_connected_at FROM users WHERE id = ?', [req.userId]);
  const user = (rows.rows as User[])[0];
  ok(res, {
    connected: Boolean(user?.slack_access_token),
    teamId: user?.slack_team_id ?? null,
    channelId: user?.slack_channel_id ?? null,
    connectedAt: user?.slack_connected_at ?? null,
  });
}

export async function disconnectSlackRequest(req: Request, res: Response): Promise<void> {
  if (!req.userId) throw new AppError(401, 'Authentication required');
  await disconnectSlack(req.userId);
  ok(res, { disconnected: true });
}