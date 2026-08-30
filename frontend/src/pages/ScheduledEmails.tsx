import { useEffect, useState } from 'react';
import { emailsApi } from '../api/emails';
import { useApiData } from '../hooks/useApiData';
import { DataTable, type Column } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';
import { formatDateTime } from '../utils/format';
import type { Email } from '../types';

export function ScheduledEmails(): JSX.Element {
  const { data, loading, error, reload } = useApiData<Email[]>(() => emailsApi.scheduled(), []);
  const { addToast } = useToast();
  const [cancelTarget, setCancelTarget] = useState<Email | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => reload(), 10000);
    return () => window.clearInterval(id);
  }, [reload]);

  const confirmCancel = async (): Promise<void> => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await emailsApi.cancel(cancelTarget.id);
      addToast('Email cancelled.');
      setCancelTarget(null);
      await reload();
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setCancelling(false);
    }
  };

  const columns: Column<Email>[] = [
    { key: 'to', header: 'Email', render: (e) => e.to_email },
    { key: 'subject', header: 'Subject', render: (e) => e.subject },
    { key: 'scheduled', header: 'Scheduled for', render: (e) => formatDateTime(e.scheduled_at) },
    { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> },
    {
      key: 'actions',
      header: '',
      render: (e) => (
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCancelTarget(e)}>
          Cancel
        </button>
      ),
    },
  ];

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Scheduled Emails</h2>
        <p>Emails waiting to be sent. Refreshes automatically.</p>
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
          emptyTitle="No scheduled emails"
          emptyDescription="Emails you schedule will appear here."
        />
      )}

      <Modal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Cancel scheduled email"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>
              Keep it
            </Button>
            <Button variant="danger" loading={cancelling} onClick={confirmCancel}>
              Cancel email
            </Button>
          </>
        }
      >
        <p>
          Are you sure you want to cancel this email to <strong>{cancelTarget?.to_email}</strong> scheduled for{' '}
          {cancelTarget ? formatDateTime(cancelTarget.scheduled_at) : ''}?
        </p>
      </Modal>
    </section>
  );
}