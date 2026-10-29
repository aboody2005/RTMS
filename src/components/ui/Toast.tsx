'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastCallable {
  (message: string, options?: { type?: ToastType; title?: string; duration?: number }): void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

interface ToastContextType {
  toast: ToastCallable;
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const lastToastRef = useRef<{ message: string; time: number } | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, title?: string, duration: number = 4000) => {
      // Prevent rapid duplicate toasts
      const now = Date.now();
      if (
        lastToastRef.current &&
        lastToastRef.current.message === message &&
        now - lastToastRef.current.time < 2000
      ) {
        return;
      }
      lastToastRef.current = { message, time: now };

      const id = `${now}-${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastMessage = { id, type, message, title, duration };

      setToasts((prev) => [...prev.slice(-2), newToast]); // Keep at most 3

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toastFn = useCallback(
    (message: string, options?: { type?: ToastType; title?: string; duration?: number }) => {
      const type = options?.type || 'info';
      showToast(type, message, options?.title, options?.duration);
    },
    [showToast]
  ) as any;

  toastFn.success = (message: string, title?: string) => showToast('success', message, title);
  toastFn.error = (message: string, title?: string) => showToast('error', message, title);
  toastFn.warning = (message: string, title?: string) => showToast('warning', message, title);
  toastFn.info = (message: string, title?: string) => showToast('info', message, title);

  return (
    <ToastContext.Provider value={{ toast: toastFn, showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="toast-container"
      aria-live="polite"
      role="region"
      aria-label="إشعارات النظام"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: () => void;
}) {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  const borderColors = {
    success: 'var(--success-solid)',
    error: 'var(--danger-solid)',
    warning: 'var(--warning-solid)',
    info: 'var(--primary)',
  };

  const iconBgs = {
    success: 'var(--success-bg)',
    error: 'var(--danger-bg)',
    warning: 'var(--warning-bg)',
    info: 'var(--primary-light)',
  };

  const iconColors = {
    success: 'var(--success-text)',
    error: 'var(--danger-text)',
    warning: 'var(--warning-text)',
    info: 'var(--primary-text)',
  };

  return (
    <div
      className="toast-item"
      style={{
        borderInlineStart: `4px solid ${borderColors[toast.type]}`,
      }}
    >
      <div
        className="toast-icon"
        style={{
          backgroundColor: iconBgs[toast.type],
          color: iconColors[toast.type],
        }}
      >
        {icons[toast.type]}
      </div>
      <div className="toast-content">
        {toast.title && <div className="toast-title">{toast.title}</div>}
        <div className="toast-message">{toast.message}</div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="toast-close-btn"
        aria-label="إغلاق الإشعار"
      >
        ✕
      </button>
    </div>
  );
}
