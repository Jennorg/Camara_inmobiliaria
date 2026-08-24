import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (options: Omit<Toast, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const toast = useCallback((options: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration = options.duration ?? 4000;

    setToasts(prev => [...prev.slice(-4), { ...options, id }]); // max 5 toasts

    const timer = setTimeout(() => dismiss(id), duration);
    timers.current.set(id, timer);
  }, [dismiss]);

  const success = useCallback((title: string, message?: string) => toast({ title, message, variant: 'success' }), [toast]);
  const error   = useCallback((title: string, message?: string) => toast({ title, message, variant: 'error', duration: 6000 }), [toast]);
  const warning = useCallback((title: string, message?: string) => toast({ title, message, variant: 'warning' }), [toast]);
  const info    = useCallback((title: string, message?: string) => toast({ title, message, variant: 'info' }), [toast]);

  const value = useMemo(
    () => ({ toasts, toast, success, error, warning, info, dismiss }),
    [toasts, toast, success, error, warning, info, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── Visual config per variant ────────────────────────────────────────────────

const VARIANT_CONFIG: Record<ToastVariant, {
  icon: React.ElementType;
  bar: string;
  iconColor: string;
  bg: string;
  border: string;
  textColor: string;
  subTextColor: string;
  closeColor: string;
}> = {
  success: {
    icon: CheckCircle,
    bar: 'bg-emerald-400',
    iconColor: 'text-white',
    bg: 'bg-emerald-600',
    border: 'border-emerald-700',
    textColor: 'text-white',
    subTextColor: 'text-emerald-100',
    closeColor: 'text-emerald-100 hover:text-white hover:bg-emerald-500/50',
  },
  error: {
    icon: XCircle,
    bar: 'bg-red-500',
    iconColor: 'text-red-500',
    bg: 'bg-white',
    border: 'border-red-100',
    textColor: 'text-gray-900',
    subTextColor: 'text-gray-500',
    closeColor: 'text-gray-400 hover:text-gray-700 hover:bg-gray-100',
  },
  warning: {
    icon: AlertCircle,
    bar: 'bg-amber-400',
    iconColor: 'text-amber-500',
    bg: 'bg-white',
    border: 'border-amber-100',
    textColor: 'text-gray-900',
    subTextColor: 'text-gray-500',
    closeColor: 'text-gray-400 hover:text-gray-700 hover:bg-gray-100',
  },
  info: {
    icon: Info,
    bar: 'bg-emerald-400',
    iconColor: 'text-white',
    bg: 'bg-emerald-600',
    border: 'border-emerald-700',
    textColor: 'text-white',
    subTextColor: 'text-emerald-100',
    closeColor: 'text-emerald-100 hover:text-white hover:bg-emerald-500/50',
  },
};

// ─── Individual Toast Item ────────────────────────────────────────────────────

function ToastItem({ t, dismiss }: { t: Toast; dismiss: (id: string) => void }) {
  const cfg = VARIANT_CONFIG[t.variant];
  const Icon = cfg.icon;

  return (
    <div
      className={`
        relative flex items-start gap-3 w-full max-w-sm
        ${cfg.bg} ${cfg.border}
        border rounded-2xl shadow-xl shadow-black/8
        p-4 pr-10 overflow-hidden
        animate-in slide-in-from-right-4 fade-in duration-300
      `}
      role="alert"
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${cfg.bar}`} />

      {/* Icon */}
      <Icon size={18} className={`${cfg.iconColor} shrink-0 mt-0.5`} strokeWidth={2.5} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-black uppercase tracking-widest leading-tight ${cfg.textColor}`}>
          {t.title}
        </p>
        {t.message && (
          <p className={`text-[11px] font-medium mt-0.5 leading-relaxed ${cfg.subTextColor}`}>
            {t.message}
          </p>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => dismiss(t.id)}
        className={`absolute top-3 right-3 w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${cfg.closeColor}`}
        aria-label="Cerrar"
      >
        <X size={12} strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ─── Toast Container ──────────────────────────────────────────────────────────

function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 items-end"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map(t => (
        <ToastItem key={t.id} t={t} dismiss={dismiss} />
      ))}
    </div>
  );
}
