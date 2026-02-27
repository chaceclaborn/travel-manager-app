'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const toastConfig: Record<ToastType, { bg: string; border: string; icon: string; progress: string }> = {
  success: {
    bg: 'bg-white',
    border: 'border-emerald-200',
    icon: 'text-emerald-500',
    progress: 'bg-emerald-500',
  },
  error: {
    bg: 'bg-white',
    border: 'border-red-200',
    icon: 'text-red-500',
    progress: 'bg-red-500',
  },
  info: {
    bg: 'bg-white',
    border: 'border-blue-200',
    icon: 'text-blue-500',
    progress: 'bg-blue-500',
  },
};

const toastDurations: Record<ToastType, number> = {
  success: 4000,
  error: 6000,
  info: 5000,
};

function ToastIcon({ type }: { type: ToastType }) {
  const config = toastConfig[type];
  const cls = `size-5 shrink-0 ${config.icon}`;
  switch (type) {
    case 'success':
      return <CheckCircle2 className={cls} />;
    case 'error':
      return <XCircle className={cls} />;
    case 'info':
      return <Info className={cls} />;
  }
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useTMToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useTMToast must be used within a TMToastProvider');
  }
  return context;
}

export function TMToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++counterRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);

    const duration = toastDurations[type];
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col-reverse gap-3 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => {
            const config = toastConfig[toast.type];
            const duration = toastDurations[toast.type];
            return (
              <motion.div
                key={toast.id}
                layout
                role="alert"
                aria-live="polite"
                initial={{ opacity: 0, x: 80, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`pointer-events-auto relative w-[360px] overflow-hidden rounded-xl border ${config.border} ${config.bg} shadow-lg shadow-black/5`}
              >
                <div className="flex items-start gap-3 px-4 py-3 pr-10">
                  <div className="mt-0.5">
                    <ToastIcon type={toast.type} />
                  </div>
                  <p className="text-sm font-medium text-slate-800 leading-snug">{toast.message}</p>
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="absolute right-2.5 top-2.5 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Dismiss"
                >
                  <X className="size-3.5" />
                </button>
                <div className="h-[3px] w-full bg-slate-100">
                  <div
                    className={`h-full ${config.progress} rounded-full`}
                    style={{
                      animation: `toast-progress ${duration}ms linear forwards`,
                    }}
                  />
                </div>
                <style>{`
                  @keyframes toast-progress {
                    from { width: 100%; }
                    to { width: 0%; }
                  }
                `}</style>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
