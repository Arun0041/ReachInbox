import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-4 z-[100]" onMouseDown={onClose}>
      <div className="w-full max-w-[440px] bg-white rounded-xl shadow-xl overflow-hidden" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <button className="text-gray-400 hover:text-gray-600 text-xl leading-none" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-3 px-5 py-4 bg-gray-50 border-t border-gray-100">{footer}</div>}
      </div>
    </div>
  );
}