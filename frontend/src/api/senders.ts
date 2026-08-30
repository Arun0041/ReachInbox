import { api } from './client';
import type { Sender } from '../types';

export const sendersApi = {
  list: () => api.get<{ data: { senders: Sender[] } }>('/senders').then((r) => r.data.data.senders),
  create: (payload: Partial<Sender> & { email: string; name: string }) =>
    api.post<{ data: { sender: Sender } }>('/senders', payload).then((r) => r.data.data.sender),
};