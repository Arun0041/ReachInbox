import { api } from './client';
import type { Email, ScheduleEmailPayload } from '../types';

export const emailsApi = {
  create: (payload: ScheduleEmailPayload) =>
    api.post<{ data: { scheduled: number; batchId: string } }>('/emails', payload).then((r) => r.data.data),
  scheduled: () => api.get<{ data: { emails: Email[] } }>('/emails/scheduled').then((r) => r.data.data.emails),
  sent: () => api.get<{ data: { emails: Email[] } }>('/emails/sent').then((r) => r.data.data.emails),
  search: (q: string, status?: string) =>
    api
      .get<{ data: { emails: Email[] } }>('/emails/search', { params: { q, status } })
      .then((r) => r.data.data.emails),
  cancel: (id: string) => api.delete<{ data: { email: Email } }>(`/emails/${id}`).then((r) => r.data.data.email),
};