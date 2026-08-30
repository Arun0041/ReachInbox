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

  if (cancelTarget) {
    return (
      <div className="flex flex-col h-full bg-white relative w-full">
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={() => setCancelTarget(null)} className="text-gray-500 hover:text-gray-900 transition-colors shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            </button>
            <h1 className="text-xl font-normal text-gray-900 truncate pr-4">{cancelTarget.subject || '(no subject)'}</h1>
          </div>
          <div className="flex items-center gap-5 text-gray-400 shrink-0">
            <Star onClick={() => addToast('Email starred!')} className="w-5 h-5 cursor-pointer hover:text-yellow-400 transition-colors" />
            <svg onClick={() => { addToast('Email archived.'); setCancelTarget(null); }} className="w-5 h-5 cursor-pointer hover:text-gray-600 transition-colors" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect width="22" height="5" x="1" y="3"/><line x1="10" x2="14" y1="12" y2="12"/></svg>
            {cancelling ? (
              <RefreshCw className="w-5 h-5 animate-spin text-red-500" />
            ) : (
              <svg onClick={confirmCancel} className="w-5 h-5 cursor-pointer hover:text-red-500 transition-colors" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
            )}
            <div className="w-px h-6 bg-gray-200 mx-1"></div>
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
              U
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto bg-white flex justify-center">
          <div className="w-full max-w-[1000px] px-8 py-10">
            {/* Sender / Recipient Row */}
            <div className="flex items-start justify-between mb-8">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-[#00b05b] text-white flex items-center justify-center font-semibold text-lg shrink-0 mt-0.5">
                  {cancelTarget.to_email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">ReachInbox</span>
                    <span className="text-sm text-gray-500">&lt;sender@example.com&gt;</span>
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                    to {cancelTarget.to_email.split('@')[0]}
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="text-sm text-gray-500 whitespace-nowrap">
                  {new Date(cancelTarget.scheduled_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#fdf2e1] text-[#d97706]">
                  <Clock className="w-3 h-3" /> Scheduled
                </div>
              </div>
            </div>

            {/* Email Body */}
            <div className="pl-14 text-gray-800 leading-relaxed whitespace-pre-wrap">
              {cancelTarget.body}
            </div>
          </div>
        </div>
      </div>
    );
  }

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
    </div>
  );
}