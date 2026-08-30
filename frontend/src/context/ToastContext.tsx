import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextValue {
  addToast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => remove(id), 4500);
  }, [remove]);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 right-4 flex flex-col gap-2 z-[200]" aria-live="polite">
        {toasts.map((t) => (
          <div 
            key={t.id} 
            className={`flex items-start gap-3 p-3 bg-white border-l-4 rounded shadow-lg min-w-[280px] max-w-sm transition-all animate-in slide-in-from-right ${
              t.type === 'success' ? 'border-green-500' : t.type === 'error' ? 'border-red-500' : 'border-blue-500'
            }`}
            role="status"
          >
            <span className="flex-1 text-sm text-gray-800">{t.message}</span>
            <button className="text-gray-400 hover:text-gray-600 text-lg leading-none" onClick={() => remove(t.id)} aria-label="Dismiss">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}