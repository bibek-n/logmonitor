"use client";

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ShowToastOptions {
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  show: (opts: ShowToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE: Record<ToastType, { color: string; Icon: typeof CheckCircle2 }> = {
  success: { color: "var(--success)", Icon: CheckCircle2 },
  error: { color: "var(--danger)", Icon: XCircle },
  info: { color: "var(--info)", Icon: Info },
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    ({ type, message, duration = 4000 }: ShowToastOptions) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[200] flex flex-col gap-2"
            style={{ bottom: 20, right: 20, maxWidth: 360 }}
          >
            {toasts.map((t) => {
              const { color, Icon } = TONE[t.type];
              return (
                <div
                  key={t.id}
                  className="flex items-start gap-2 rounded-xl border px-4 py-3"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                    boxShadow: "0 12px 28px rgba(0,0,0,0.25)",
                  }}
                >
                  <Icon size={18} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: "0.85rem", color: "var(--ink)", flex: 1 }}>{t.message}</span>
                  <button
                    onClick={() => dismiss(t.id)}
                    aria-label="Dismiss"
                    style={{ background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", padding: 0 }}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
