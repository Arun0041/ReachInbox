import { useEffect, useState } from 'react';
import { Search, Filter, RefreshCw, Star, Clock } from 'lucide-react';
import { emailsApi } from '../api/emails';
import { useApiData } from '../hooks/useApiData';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import type { Email } from '../types';

function formatShortTime(iso: string): string {
  const d = new Date(iso);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day = days[d.getDay()];
  return `${day} ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`;
}

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

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top Header */}
      <div className="h-16 flex items-center px-6 border-b border-gray-100 gap-4">
        <div className="flex-1 max-w-[480px]">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
              className="w-full pl-10 pr-4 py-2 bg-[#f8f9fa] border-none rounded-full text-sm outline-none focus:ring-1 focus:ring-gray-200"
            />
          </div>
        </div>
        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
          <Filter className="w-4 h-4" />
        </button>
        <button 
          className={`p-2 text-gray-400 hover:text-gray-600 transition-colors ${loading ? 'animate-spin' : ''}`}
          onClick={reload}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="p-6 text-red-500 text-sm">{error}</div>
        )}
        
        {!error && (!data || data.length === 0) && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="text-sm">No scheduled emails</div>
          </div>
        )}

        <div className="flex flex-col">
          {data?.map((email) => (
            <div 
              key={email.id} 
              className="group flex items-center px-6 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => setCancelTarget(email)}
              title="Click to cancel"
            >
              <div className="w-[180px] font-medium text-[13px] text-gray-900 truncate">
                To: {email.to_email}
              </div>
              
              <div className="shrink-0 flex items-center justify-center px-2.5 py-1 rounded-full bg-[#fdf2e1] text-[#d97706] text-[11px] font-semibold mr-4 gap-1.5 whitespace-nowrap">
                <Clock className="w-3.5 h-3.5" />
                {formatShortTime(email.scheduled_at)}
              </div>
              
              <div className="flex-1 min-w-0 truncate text-[13px]">
                <span className="font-semibold text-gray-900">{email.subject || '(no subject)'}</span>
                <span className="text-gray-300 mx-2">-</span>
                <span className="text-gray-500">{email.body || ''}</span>
              </div>
              
              <button className="ml-4 text-gray-300 hover:text-yellow-400 transition-colors shrink-0">
                <Star className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

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
        <p className="text-sm text-gray-600">
          Are you sure you want to cancel this email to <strong className="text-gray-900">{cancelTarget?.to_email}</strong>?
        </p>
      </Modal>
    </div>
  );
}