import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const colors = {
  success: { border: 'var(--success)', bg: 'var(--success-bg)', icon: 'var(--success)' },
  error: { border: 'var(--danger)', bg: 'var(--danger-bg)', icon: 'var(--danger)' },
  info: { border: 'var(--info)', bg: 'var(--info-bg)', icon: 'var(--info)' },
};

function ToastItem({ id, type, message, onDismiss }) {
  const Icon = icons[type] || icons.info;
  const color = colors[type] || colors.info;

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-[var(--radius-sm)] shadow-[var(--shadow-lg)] animate-slideInRight"
      style={{
        background: 'var(--surface)',
        border: `1px solid var(--border)`,
        borderLeft: `3px solid ${color.border}`,
        minWidth: 280,
        maxWidth: 400,
      }}
    >
      <Icon size={18} style={{ color: color.icon, flexShrink: 0, marginTop: 1 }} />
      <p className="flex-1 text-sm text-[var(--text)]">{message}</p>
      <button
        onClick={() => onDismiss(id)}
        className="flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed bottom-6 right-6 z-[10000] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem {...toast} onDismiss={dismissToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
