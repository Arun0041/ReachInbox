import type { EmailStatus } from '../../types';
import { Badge } from './Badge';

const STATUS_CONFIG: Record<EmailStatus, { label: string; variant: 'success' | 'danger' | 'warning' | 'info' | 'neutral' }> = {
  sent: { label: 'Sent', variant: 'success' },
  failed: { label: 'Failed', variant: 'danger' },
  scheduled: { label: 'Scheduled', variant: 'info' },
  processing: { label: 'Processing', variant: 'warning' },
  cancelled: { label: 'Cancelled', variant: 'neutral' },
};

export function StatusBadge({ status }: { status: EmailStatus }): JSX.Element {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: 'neutral' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}