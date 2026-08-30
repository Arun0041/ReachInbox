import { useEffect } from 'react';
import { Search, Filter, RefreshCw, Star } from 'lucide-react';
import { emailsApi } from '../api/emails';
import { useApiData } from '../hooks/useApiData';
import type { Email } from '../types';

interface EmailInfo {
  messageId: string | null;
  previewUrl: string | null;
}

function parseInfo(email: Email): EmailInfo {
  try {
    if (email.info) return JSON.parse(email.info) as EmailInfo;
  } catch {
    // ignore
  }
  return { messageId: null, previewUrl: null };
}

export function SentEmails(): JSX.Element {
  const { data, loading, error, reload } = useApiData<Email[]>(() => emailsApi.sent(), []);

  useEffect(() => {
    const id = window.setInterval(() => reload(), 15000);
    return () => window.clearInterval(id);
  }, [reload]);

  const handleRowClick = (email: Email) => {
    const info = parseInfo(email);
    if (info.previewUrl) {
      window.open(info.previewUrl, '_blank');
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
            <div className="text-sm">No sent emails</div>
          </div>
        )}

        <div className="flex flex-col">
          {data?.map((email) => (
            <div 
              key={email.id} 
              className="group flex items-center px-6 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => handleRowClick(email)}
              title={parseInfo(email).previewUrl ? "Click to open preview" : ""}
            >
              <div className="w-[180px] font-medium text-[13px] text-gray-900 truncate">
                To: {email.to_email}
              </div>
              
              <div className="shrink-0 flex items-center justify-center px-3 py-1 rounded-full bg-[#f1f5f9] text-gray-500 text-[11px] font-semibold mr-4 whitespace-nowrap">
                {email.status === 'failed' ? 'Failed' : 'Sent'}
              </div>
              
              <div className="flex-1 min-w-0 truncate text-[13px]">
                <span className="font-semibold text-gray-900">{email.subject || '(no subject)'}</span>
                <span className="text-gray-300 mx-2">-</span>
                <span className="text-gray-500">{email.status === 'failed' ? email.error : (email.body || '')}</span>
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