export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface User {
  id: number;
  google_id: string | null;
  email: string;
  name: string;
  avatar_url: string | null;
  password_hash?: string | null;
  slack_access_token?: string | null;
  slack_team_id?: string | null;
  slack_channel_id?: string | null;
  slack_connected_at?: string | null;
  created_at: string;
}

export interface Sender {
  id: number;
  user_id: number;
  email: string;
  name: string;
  provider: 'ethereal' | 'smtp';
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  active: boolean;
  created_at: string;
}

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
  attachments: string | null;
}

export interface EmailAttachment {
  filename: string;
  content: string;
  contentType?: string;
}

export interface EmailJobData {
  emailId: string;
  userId: number;
  senderId: number;
  to: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
}

export interface ScheduleBatchInput {
  userId: number;
  senderId?: number;
  toEmails: string[];
  subject: string;
  body: string;
  startAt: string;
  delayBetweenMs: number;
  hourlyLimit?: number;
  attachments?: EmailAttachment[];
}