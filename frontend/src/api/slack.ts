import { api } from './client';
import type { SlackStatus } from '../types';

export const slackApi = {
  connect: () => api.get<{ data: { authUrl: string } }>('/slack/connect').then((r) => r.data.data.authUrl),
  status: () => api.get<{ data: SlackStatus }>('/slack/status').then((r) => r.data.data),
  disconnect: () => api.post<{ data: { disconnected: boolean } }>('/slack/disconnect').then((r) => r.data.data),
};