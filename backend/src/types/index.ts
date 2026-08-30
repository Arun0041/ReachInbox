export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface User {
  id: number;
  email: string;
  name: string;
  password_hash?: string;
  created_at: string;
}

export interface Email {
  id: string;
  user_id: number;
  to_email: string;
  subject: string;
  body: string;
  scheduled_at: string;
  status: EmailStatus;
  error: string | null;
  info: string | null;
  created_at: string;
  sent_at: string | null;
  attempts: number;
}

export interface AuthPayload {
  userId: number;
  email: string;
}