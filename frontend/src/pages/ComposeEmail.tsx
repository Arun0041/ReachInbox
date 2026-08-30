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
  
  const [toEmails, setToEmails] = useState<string[]>([]);
  
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
  
  const [attachments, setAttachments] = useState<{ filename: string; content: string; contentType?: string }[]>([]);
  const attachmentRef = useRef<HTMLInputElement>(null);

  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});

  const updateFormattingState = () => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      justifyLeft: document.queryCommandState('justifyLeft'),
      justifyCenter: document.queryCommandState('justifyCenter'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      blockquote: document.queryCommandValue('formatBlock') === 'blockquote',
    });
  };

  const execCmd = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    updateFormattingState();
  };

  const btnClass = (cmd: string) => 
    `p-1.5 rounded transition-colors ${activeFormats[cmd] ? 'bg-gray-200 text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`;

  const handleAttachment = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const result = evt.target?.result as string;
        if (!result) return;
        const base64Content = result.split(',')[1];
        setAttachments(prev => [...prev, {
          filename: file.name,
          content: base64Content,
          contentType: file.type
        }]);
      };
      reader.readAsDataURL(file);
    });
    
    if (attachmentRef.current) attachmentRef.current.value = '';
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const parsed = parseEmails(text);
      if (parsed.length) {
        setToEmails(prev => Array.from(new Set([...prev, ...parsed])));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const processEmailInput = (text: string) => {
    const parsed = parseEmails(text);
    if (parsed.length) {
      setToEmails(prev => Array.from(new Set([...prev, ...parsed])));
      setRecipientsText('');
    }
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (['Enter', ' ', ','].includes(e.key)) {
      e.preventDefault();
      processEmailInput(recipientsText);
    } else if (e.key === 'Backspace' && !recipientsText && toEmails.length > 0) {
      setToEmails(prev => prev.slice(0, -1));
    }
  };

  const removeEmail = (email: string) => {
    setToEmails(prev => prev.filter(e => e !== email));
  };

  const handleSubmit = async (immediate = false): Promise<void> => {
    setError(null);
    if (!subject.trim() || !body.trim()) {
      setError('Subject and body are required.');
      return;
    }
    
    let finalEmails = toEmails;
    const pending = parseEmails(recipientsText);
    if (pending.length) {
      finalEmails = Array.from(new Set([...finalEmails, ...pending]));
      setToEmails(finalEmails);
      setRecipientsText('');
    }

    if (finalEmails.length === 0) {
      setError('Add at least one valid email.');
      return;
    }
    const actualStartAt = immediate ? new Date() : new Date(startAt);
    if (Number.isNaN(actualStartAt.getTime())) {
      setError('Please enter a valid start time.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        subject,
        body,
        toEmails: finalEmails,
        startAt: actualStartAt.toISOString(),
        delayBetweenMs: (Number.parseInt(delaySec, 10) || 0) * 1000,
        hourlyLimit: Number.parseInt(hourlyLimit, 10) || undefined,
        attachments: attachments.length > 0 ? attachments : undefined
      };
      
      const result = await emailsApi.create(payload);
      addToast(immediate ? `Sent ${result.scheduled} email(s)!` : `Scheduled ${result.scheduled} email(s).`);
      navigate(immediate ? '/dashboard/sent' : '/dashboard/scheduled');
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
          <input ref={attachmentRef} type="file" multiple onChange={handleAttachment} hidden />
          <button type="button" onClick={() => attachmentRef.current?.click()} className="text-gray-400 hover:text-gray-600 transition-colors">
            <Paperclip className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setShowSendLater(!showSendLater)} className="text-gray-400 hover:text-gray-600 transition-colors">
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
      <div className="flex-1 flex flex-col overflow-auto px-8 py-8 w-full">
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
            <div className="flex flex-wrap gap-2 mb-2 max-h-[140px] overflow-y-auto">
              {toEmails.map(email => (
                <span key={email} className="px-2.5 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-xs flex items-center gap-1.5">
                  {email}
                  <button type="button" onClick={() => removeEmail(email)} className="text-green-600 hover:text-green-900 hover:bg-green-100 rounded-full w-4 h-4 flex items-center justify-center transition-colors">×</button>
                </span>
              ))}
            </div>
            <textarea
              value={recipientsText}
              onChange={(e) => {
                setRecipientsText(e.target.value);
                if (e.target.value.includes(' ') || e.target.value.includes(',')) {
                  processEmailInput(e.target.value);
                }
              }}
              onKeyDown={handleEmailKeyDown}
              onBlur={() => processEmailInput(recipientsText)}
              placeholder={toEmails.length === 0 ? "recipient@example.com" : ""}
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

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="flex items-start gap-4 py-3 border-b border-gray-50">
            <div className="w-20 text-sm font-medium text-gray-800 mt-1">Files</div>
            <div className="flex-1 flex flex-wrap gap-2">
              {attachments.map((file, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-md text-sm text-gray-700">
                  <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                  <span className="max-w-[200px] truncate">{file.filename}</span>
                  <button 
                    type="button" 
                    onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-gray-400 hover:text-red-500 ml-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
        <div className="flex-1 mt-4 border border-gray-50 rounded-xl bg-[#fafafa] flex flex-col overflow-hidden min-h-[300px]">
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-4 py-3 border-b border-gray-50 flex-wrap">
            <button type="button" onClick={() => execCmd('undo')} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"><Undo2 className="w-4 h-4" /></button>
            <button type="button" onClick={() => execCmd('redo')} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"><Redo2 className="w-4 h-4" /></button>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <button type="button" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded flex items-center gap-1 transition-colors">
              <Type className="w-4 h-4" />
              <ChevronsUpDown className="w-3 h-3" />
            </button>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <button type="button" onClick={() => execCmd('bold')} className={btnClass('bold')}><Bold className="w-4 h-4" /></button>
            <button type="button" onClick={() => execCmd('italic')} className={btnClass('italic')}><Italic className="w-4 h-4" /></button>
            <button type="button" onClick={() => execCmd('underline')} className={btnClass('underline')}><Underline className="w-4 h-4" /></button>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <button type="button" onClick={() => execCmd('justifyLeft')} className={btnClass('justifyLeft')}><AlignLeft className="w-4 h-4" /></button>
            <button type="button" onClick={() => execCmd('justifyCenter')} className={btnClass('justifyCenter')}><ChevronsUpDown className="w-4 h-4" /></button>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <button type="button" onClick={() => execCmd('insertOrderedList')} className={btnClass('insertOrderedList')}><ListOrdered className="w-4 h-4" /></button>
            <button type="button" onClick={() => execCmd('insertUnorderedList')} className={btnClass('insertUnorderedList')}><List className="w-4 h-4" /></button>
            <button type="button" onClick={() => execCmd('outdent')} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"><IndentDecrease className="w-4 h-4" /></button>
            <button type="button" onClick={() => execCmd('indent')} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"><IndentIncrease className="w-4 h-4" /></button>
            <button type="button" onClick={() => execCmd('formatBlock', 'blockquote')} className={btnClass('blockquote')}><Quote className="w-4 h-4" /></button>
            <button type="button" onClick={() => { const url = prompt('Image URL:'); if (url) execCmd('insertImage', url); }} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"><ImageIcon className="w-4 h-4" /></button>
            <button type="button" onClick={() => { const url = prompt('Link URL:'); if (url) execCmd('createLink', url); }} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"><LinkIcon className="w-4 h-4" /></button>
          </div>
          {/* Editor Body */}
          <div
            contentEditable
            onInput={(e) => setBody(e.currentTarget.innerHTML)}
            onKeyUp={updateFormattingState}
            onMouseUp={updateFormattingState}
            data-placeholder="Type Your Reply..."
            className="flex-1 w-full bg-transparent outline-none p-4 text-sm text-gray-700 focus:ring-0 overflow-y-auto before:content-[attr(data-placeholder)] before:text-gray-400 empty:before:block [&:not(:empty)]:before:hidden"
            style={{ minHeight: '150px' }}
          />
        </div>
      </div>
    </div>
  );
}