import axios, { AxiosError } from 'axios';

const baseURL = (import.meta.env.VITE_API_URL as string) || '/api';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('outbox_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: { message?: string } }>) => {
    const serverMessage = error.response?.data?.error?.message;
    const message = serverMessage || error.message || 'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}