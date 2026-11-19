"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Keyboard, X } from "lucide-react";
import { useUiOverlays } from "@/lib/uiOverlaysStore";

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "Ctrl / Cmd + K", label: "Open the command palette (go to a page, staff member, website...)" },
  { keys: "?", label: "Show this list of shortcuts" },
  { keys: "Esc", label: "Close the command palette, this overlay, or any open dialog" },
  { keys: "↑ / ↓", label: "Move the selection inside the command palette" },
  { keys: "Enter", label: "Open the highlighted command-palette result" },
];

// Mounted once in DashShellClient, alongside CommandPalette - a plain "?" press anywhere in the
// dashboard (outside of a text field) surfaces this, the same low-cost discoverability pattern
// GitHub/Linear/Slack use for their own shortcut lists.
export function ShortcutsOverlay() {
  const { shortcutsOpen, openShortcuts, closeShortcuts } = useUiOverlays();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.key === "?" && !isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openShortcuts();
      } else if (e.key === "Escape" && shortcutsOpen) {
        closeShortcuts();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [shortcutsOpen, openShortcuts, closeShortcuts]);

  if (!shortcutsOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[310] flex items-center justify-center p-4"
      style={{ background: "rgba(2,6,23,0.55)", backdropFilter: "blur(2px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeShortcuts();
      }}
    >
      <div
        className="w-full rounded-2xl border"
        style={{ maxWidth: 420, background: "var(--surface)", borderColor: "var(--border)", boxShadow: "0 24px 60px rgba(0,0,0,0.35)" }}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <Keyboard size={16} style={{ color: "var(--ink-muted)" }} />
          <span style={{ flex: 1, fontSize: "0.92rem", fontWeight: 600, color: "var(--ink)" }}>Keyboard shortcuts</span>
          <button
            type="button"
            onClick={closeShortcuts}
            aria-label="Close"
            style={{ background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", display: "flex" }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: "0.6rem 0.4rem" }}>
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center gap-3" style={{ padding: "0.5rem 0.75rem" }}>
              <kbd
                style={{
                  fontSize: "0.72rem",
                  color: "var(--ink)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "0.15rem 0.5rem",
                  background: "var(--surface-2)",
                  whiteSpace: "nowrap",
                  minWidth: 92,
                  textAlign: "center",
                }}
              >
                {s.keys}
              </kbd>
              <span style={{ fontSize: "0.85rem", color: "var(--ink-secondary)" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
