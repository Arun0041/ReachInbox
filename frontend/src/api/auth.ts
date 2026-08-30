import { api } from './client';
import type { AuthResponse, User } from '../types';

export const authApi = {
  register: (payload: { name: string; email: string; password: string }) =>
    api.post<{ data: AuthResponse }>('/auth/register', payload).then((r) => r.data.data),
  login: (payload: { email: string; password: string }) =>
    api.post<{ data: AuthResponse }>('/auth/login', payload).then((r) => r.data.data),
  me: () => api.get<{ data: { user: User } }>('/auth/me').then((r) => r.data.data.user),
};