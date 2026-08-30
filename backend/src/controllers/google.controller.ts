import type { Request, Response } from 'express';
import { env } from '../config/env';
import { findOrCreateGoogleUser, signToken } from '../services/auth.service';
import { AppError } from '../utils/AppError';

export function googleAuthStart(req: Request, res: Response): void {
  if (!env.GOOGLE_CLIENT_ID) throw new AppError(500, 'Google OAuth is not configured');
  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('access_type', 'online');
  res.redirect(url.toString());
}

export async function googleAuthCallback(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string | undefined;
  if (!code) throw new AppError(400, 'Missing authorization code');
  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokens.access_token) throw new AppError(401, `Google OAuth failed: ${tokens.error ?? 'no token'}`);

  const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = (await infoRes.json()) as {
    id?: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  if (!profile.id || !profile.email) throw new AppError(401, 'Could not read Google profile');

  const user = await findOrCreateGoogleUser({
    sub: profile.id,
    email: profile.email,
    name: profile.name ?? profile.email,
    picture: profile.picture,
  });
  const appToken = signToken(user);
  res.redirect(`${env.FRONTEND_URL}/auth/callback?token=${encodeURIComponent(appToken)}`);
}