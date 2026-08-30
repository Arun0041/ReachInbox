import { env } from '../config/env';
import { getDb } from '../config/db';
import type { User, Sender } from '../types';

export interface SlackTokens {
  access_token: string;
  team_id?: string;
  user_id?: string;
  channel_id?: string;
}

export async function exchangeSlackCode(code: string): Promise<SlackTokens> {
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
    throw new Error('Slack OAuth is not configured');
  }
  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
    }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    access_token?: string;
    team?: { id?: string };
    authed_user?: { id?: string };
    error?: string;
  };
  if (!data.ok || !data.access_token) {
    throw new Error(`Slack OAuth failed: ${data.error ?? 'unknown'}`);
  }
  return { access_token: data.access_token, team_id: data.team?.id, user_id: data.authed_user?.id };
}

export async function saveSlackConnection(userId: number, tokens: SlackTokens): Promise<void> {
  const db = getDb();
  await db.raw(
    `UPDATE users SET slack_access_token = ?, slack_team_id = ?, slack_connected_at = now() WHERE id = ?`,
    [tokens.access_token, tokens.team_id ?? null, userId]
  );
}

export async function disconnectSlack(userId: number): Promise<void> {
  const db = getDb();
  await db.raw(
    `UPDATE users SET slack_access_token = NULL, slack_team_id = NULL, slack_connected_at = NULL WHERE id = ?`,
    [userId]
  );
}

export async function sendSlackNotification(user: User, sender: Sender, message: string): Promise<boolean> {
  if (!user.slack_access_token) return false;
  const channel = user.slack_channel_id ?? user.slack_team_id ?? null;
  if (!channel) return false;
  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${user.slack_access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel, text: message }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      console.warn('[slack] postMessage failed:', data.error);
      return false;
    }
    console.log('[slack] rate-limit notification sent to', channel);
    return true;
  } catch (err) {
    console.warn('[slack] postMessage error:', (err as Error).message);
    return false;
  }
}