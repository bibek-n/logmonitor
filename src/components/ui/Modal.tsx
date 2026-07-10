"use client";

import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  footer?: ReactNode;
}

const SIZE_WIDTH: Record<string, number> = { sm: 420, md: 560, lg: 760 };

export function Modal({ open, onClose, title, size = "md", children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(2,6,23,0.55)", backdropFilter: "blur(2px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn("w-full rounded-2xl border flex flex-col")}
        style={{
          maxWidth: SIZE_WIDTH[size],
          maxHeight: "88vh",
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
        }}
      >
        {title && (
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <h2 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--ink)", margin: 0 }}>{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ color: "var(--ink-muted)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="px-5 py-4" style={{ overflowY: "auto" }}>
          {children}
        </div>
        {footer && (
          <div
            className="flex items-center justify-end gap-2 px-5 py-3 border-t"
            style={{ borderColor: "var(--border)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
