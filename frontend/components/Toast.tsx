"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";

type ToastType = "success" | "error" | "info" | "pending";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  txId?: string;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, txId?: string) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let toastId = 0;
const MAX_TOASTS = 5; // Limit visible toasts

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", txId?: string) => {
      const id = ++toastId;
      setToasts((prev) => {
        // Limit queue — remove oldest if over max
        const updated = [...prev, { id, message, type, txId }];
        if (updated.length > MAX_TOASTS) {
          return updated.slice(updated.length - MAX_TOASTS);
        }
        return updated;
      });
      // Auto-dismiss after 5s (except pending)
      if (type !== "pending") {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5000);
      } else {
        // Pending toasts auto-dismiss after 60s as safety
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 60000);
      }
    },
    []
  );

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container with ARIA live region for accessibility */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm sm:max-w-md"
        role="status"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const colors = {
    success: "border-green-500/50 bg-green-950/90",
    error: "border-red-500/50 bg-red-950/90",
    info: "border-blue-500/50 bg-blue-950/90",
    pending: "border-orange-500/50 bg-orange-950/90",
  };

  const icons = {
    success: (
      <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    pending: (
      <svg className="w-5 h-5 text-orange-400 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    ),
  };

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-lg transition-all duration-300 ${
        colors[toast.type]
      } ${visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}
      role="alert"
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">{toast.message}</p>
        {toast.txId && (
          <p className="text-xs text-gray-400 mt-1 font-mono truncate" title={toast.txId}>
            tx: {toast.txId.slice(0, 10)}...{toast.txId.slice(-6)}
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-gray-500 hover:text-white transition-colors shrink-0 p-1 min-w-[28px] min-h-[28px] flex items-center justify-center"
        aria-label="Dismiss notification"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
