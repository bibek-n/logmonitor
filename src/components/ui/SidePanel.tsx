"use client";

import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  width?: number;
  children: ReactNode;
}

// Same portal/Escape/backdrop-click contract as Modal.tsx (src/components/ui/Modal.tsx), just
// sliding in from the right via framer-motion (already a dependency, used elsewhere by
// Card's hoverLift) instead of Modal's centered fade. There is no other true slide-out panel
// anywhere in this app yet - places named "...Drawer" (IssueDetailsDrawer etc.) are actually
// Modal under the hood - this is the first real one, worth reaching for whenever a future
// feature wants a side panel rather than duplicating this pattern inline.
export function SidePanel({ open, onClose, title, width = 420, children }: SidePanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100]"
          style={{ background: "rgba(2,6,23,0.55)", backdropFilter: "blur(2px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            className="fixed right-0 top-0 h-full flex flex-col"
            style={{
              width: "100%",
              maxWidth: width,
              background: "var(--surface)",
              borderLeft: "1px solid var(--border)",
              boxShadow: "-24px 0 60px rgba(0,0,0,0.35)",
            }}
            initial={{ x: width }}
            animate={{ x: 0 }}
            exit={{ x: width }}
            transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
          >
            {title && (
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
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
            <div className="px-5 py-4" style={{ overflowY: "auto", flex: 1 }}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
