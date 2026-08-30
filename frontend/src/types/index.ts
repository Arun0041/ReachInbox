export interface User {
  id: number;
  google_id: string | null;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
}

export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface Email {
  id: string;
  user_id: number;
  sender_id: number | null;
  to_email: string;
  subject: string;
  body: string;
  scheduled_at: string;
  status: EmailStatus;
  error: string | null;
  info: string | null;
  batch_id: string | null;
  created_at: string;
  sent_at: string | null;
  attempts: number;
  hourly_limit: number | null;
}

export interface Sender {
  id: number;
  user_id: number;
  email: string;
  name: string;
  provider: 'ethereal' | 'smtp';
  active: boolean;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ScheduleEmailPayload {
  subject: string;
  body: string;
  toEmails: string[];
  startAt: string;
  delayBetweenMs: number;
  hourlyLimit?: number;
  senderId?: number;
}

export interface SlackStatus {
  connected: boolean;
  teamId: string | null;
  channelId: string | null;
  connectedAt: string | null;
}