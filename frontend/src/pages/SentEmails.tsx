import { useEffect } from 'react';
import { emailsApi } from '../api/emails';
import { useApiData } from '../hooks/useApiData';
import { DataTable, type Column } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { useToast } from '../context/ToastContext';
import { formatDateTime } from '../utils/format';
import type { Email } from '../types';

interface EmailInfo {
  messageId: string | null;
  previewUrl: string | null;
}

function parseInfo(email: Email): EmailInfo {
  try {
    if (email.info) return JSON.parse(email.info) as EmailInfo;
  } catch {
    // ignore malformed info
  }
  return { messageId: null, previewUrl: null };
}

export function SentEmails(): JSX.Element {
  const { data, loading, error, reload } = useApiData<Email[]>(() => emailsApi.sent(), []);
  const { addToast } = useToast();

  useEffect(() => {
    const id = window.setInterval(() => reload(), 15000);
    return () => window.clearInterval(id);
  }, [reload]);

  const copyMessageId = async (id: string | null): Promise<void> => {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      addToast('Message ID copied.');
    } catch {
      addToast('Could not copy message ID.', 'error');
    }
  };

  const columns: Column<Email>[] = [
    { key: 'to', header: 'Email', render: (e) => e.to_email },
    { key: 'subject', header: 'Subject', render: (e) => e.subject },
    { key: 'sent', header: 'Sent time', render: (e) => formatDateTime(e.sent_at) },
    { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> },
    {
      key: 'details',
      header: 'Details',
      render: (e) => {
        if (e.status === 'failed') {
          return <span className="muted" title={e.error ?? ''}>{e.error ?? 'Failed'}</span>;
        }
        const info = parseInfo(e);
        if (info.previewUrl) {
          return (
            <a className="link" href={info.previewUrl} target="_blank" rel="noreferrer">
              Preview
            </a>
          );
        }
        if (info.messageId) {
          return (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => copyMessageId(info.messageId)}>
              Copy ID
            </button>
          );
        }
        return <span className="muted">—</span>;
      },
    },
  ];

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Sent Emails</h2>
        <p>Emails that have been processed.</p>
        <button type="button" className="btn btn--secondary btn--sm" onClick={reload} disabled={loading}>
          Refresh
        </button>
      </div>

      {error ? (
        <div className="error-box">
          <p>{error}</p>
          <Button variant="secondary" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={data ?? []}
          keyExtractor={(e) => e.id}
          loading={loading}
          emptyTitle="No sent emails"
          emptyDescription="Emails that have been sent will appear here."
        />
      )}
    </section>
  );
}