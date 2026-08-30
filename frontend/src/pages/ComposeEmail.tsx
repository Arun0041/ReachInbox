import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowLeft, Paperclip, Clock, Upload, Undo2, Redo2, Type, Bold, Italic, Underline, AlignLeft, ListOrdered, List, IndentDecrease, IndentIncrease, Quote, Image as ImageIcon, Link as LinkIcon, ChevronsUpDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { emailsApi } from '../api/emails';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(text: string): string[] {
  const parts = text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  return Array.from(new Set(parts.filter((e) => EMAIL_RE.test(e))));
}

export function ComposeEmail(): JSX.Element {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientsText, setRecipientsText] = useState('');
  
  // By default schedule for 1 hour from now, formatting to YYYY-MM-DDTHH:mm
  const [startAt, setStartAt] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  
  const [delaySec, setDelaySec] = useState('00');
  const [hourlyLimit, setHourlyLimit] = useState('00');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSendLater, setShowSendLater] = useState(false);

  const toEmails = parseEmails(recipientsText);

  const handleFile = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setRecipientsText((prev) => (prev ? prev + ' ' + text : text));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSubmit = async (e?: FormEvent): Promise<void> => {
    e?.preventDefault();
    setError(null);
    if (!subject.trim() || !body.trim()) {
      setError('Subject and body are required.');
      return;
    }
    if (toEmails.length === 0) {
      setError('Add at least one valid email.');
      return;
    }
    const date = new Date(startAt);
    if (Number.isNaN(date.getTime())) {
      setError('Please enter a valid start time.');
      return;
    }
    setLoading(true);
    try {
      const result = await emailsApi.create({
        subject: subject.trim(),
        body,
        toEmails,
        startAt: date.toISOString(),
        delayBetweenMs: Math.max(0, Math.round(Number(delaySec) * 1000)),
        hourlyLimit: Number(hourlyLimit) > 0 ? Number(hourlyLimit) : undefined,
      });
      addToast(`Scheduled ${result.scheduled} email(s).`);
      navigate('/dashboard/scheduled');
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header */}
      <div className="h-16 flex items-center px-6 border-b border-gray-100 justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">Compose New Email</h1>
        </div>
        <div className="flex items-center gap-4 relative">
          <button className="text-gray-400 hover:text-gray-600 transition-colors">
            <Paperclip className="w-4 h-4" />
          </button>
          <button className="text-gray-400 hover:text-gray-600 transition-colors">
            <Clock className="w-4 h-4" />
          </button>
          
          <button 
            type="button" 
            onClick={() => setShowSendLater(!showSendLater)}
            className="px-4 py-1.5 border border-[#10B981] text-[#10B981] rounded-full text-sm font-medium hover:bg-green-50 transition-colors"
          >
            {loading ? 'Sending...' : 'Send Later'}
          </button>

          {/* Send Later Popover */}
          {showSendLater && (
            <div className="absolute top-12 right-0 w-[280px] bg-white border border-gray-100 rounded-xl shadow-lg z-50 p-4">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Send Later</h3>
              <div className="mb-4">
                <input 
                  type="datetime-local" 
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="w-full text-sm border-b border-gray-200 pb-2 outline-none text-gray-600"
                />
              </div>
              <div className="space-y-3 mb-6">
                {['Tomorrow', 'Tomorrow, 10:00 AM', 'Tomorrow, 11:00 AM', 'Tomorrow, 3:00 PM'].map((t) => (
                  <div key={t} className="text-sm text-gray-500 hover:text-gray-900 cursor-pointer">{t}</div>
                ))}
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowSendLater(false)} className="text-sm font-medium text-gray-900">Cancel</button>
                <button onClick={() => { setShowSendLater(false); handleSubmit(); }} className="px-4 py-1.5 border border-[#10B981] text-[#10B981] rounded-full text-sm font-medium hover:bg-green-50 transition-colors">
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-auto px-16 py-8 max-w-[900px]">
        {error && <div className="mb-4 text-red-500 text-sm font-medium">{error}</div>}
        
        {/* From */}
        <div className="flex items-center gap-4 py-3 border-b border-gray-50">
          <div className="w-20 text-sm font-medium text-gray-800">From</div>
          <div className="flex items-center gap-2 bg-[#f6f7fb] px-3 py-1.5 rounded-md text-sm text-gray-700 cursor-pointer">
            {user?.email || 'user@domain.io'}
            <ChevronsUpDown className="w-3.5 h-3.5 text-gray-400" />
          </div>
        </div>

        {/* To */}
        <div className="flex items-start gap-4 py-3 border-b border-gray-50">
          <div className="w-20 text-sm font-medium text-gray-800 mt-1.5">To</div>
          <div className="flex-1">
            <div className="flex flex-wrap gap-2 mb-2">
              {toEmails.slice(0, 3).map(email => (
                <span key={email} className="px-2.5 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-xs">
                  {email}
                </span>
              ))}
              {toEmails.length > 3 && (
                <span className="px-2.5 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-xs">
                  +{toEmails.length - 3}
                </span>
              )}
            </div>
            <textarea
              value={recipientsText}
              onChange={(e) => setRecipientsText(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full text-sm text-gray-600 outline-none placeholder:text-gray-300 resize-none min-h-[24px]"
              rows={1}
            />
          </div>
          <div className="flex-shrink-0">
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} hidden />
            <button 
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-sm font-medium text-[#10B981] hover:text-[#059669]"
            >
              <Upload className="w-4 h-4" />
              Upload List
            </button>
          </div>
        </div>

        {/* Subject */}
        <div className="flex items-center gap-4 py-3 border-b border-gray-50">
          <div className="w-20 text-sm font-medium text-gray-800">Subject</div>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            type="text"
            placeholder="Subject"
            className="flex-1 text-sm text-gray-900 outline-none placeholder:text-gray-300"
          />
        </div>

        {/* Delay & Limit */}
        <div className="flex items-center gap-6 py-5">
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-gray-800">Delay between 2 emails</div>
            <input
              type="text"
              value={delaySec}
              onChange={(e) => setDelaySec(e.target.value)}
              className="w-16 border border-gray-100 rounded-md px-3 py-1.5 text-sm text-gray-500 outline-none focus:border-gray-200 text-center"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-gray-800">Hourly Limit</div>
            <input
              type="text"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(e.target.value)}
              className="w-16 border border-gray-100 rounded-md px-3 py-1.5 text-sm text-gray-500 outline-none focus:border-gray-200 text-center"
            />
          </div>
        </div>

        {/* Editor Area */}
        <div className="mt-4 border border-gray-50 rounded-xl bg-[#fafafa] flex flex-col overflow-hidden min-h-[400px]">
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-4 py-3 border-b border-gray-50 flex-wrap">
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><Undo2 className="w-4 h-4" /></button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><Redo2 className="w-4 h-4" /></button>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded flex items-center gap-1">
              <Type className="w-4 h-4" />
              <ChevronsUpDown className="w-3 h-3" />
            </button>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><Bold className="w-4 h-4" /></button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><Italic className="w-4 h-4" /></button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><Underline className="w-4 h-4" /></button>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><AlignLeft className="w-4 h-4" /></button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><ChevronsUpDown className="w-4 h-4" /></button>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><ListOrdered className="w-4 h-4" /></button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><List className="w-4 h-4" /></button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><IndentDecrease className="w-4 h-4" /></button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><IndentIncrease className="w-4 h-4" /></button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><Quote className="w-4 h-4" /></button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><ImageIcon className="w-4 h-4" /></button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><LinkIcon className="w-4 h-4" /></button>
          </div>
          {/* Editor Body */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type Your Reply..."
            className="flex-1 w-full bg-transparent resize-none outline-none p-4 text-sm text-gray-700 placeholder:text-gray-400"
          />
        </div>
      </div>
    </div>
  );
}