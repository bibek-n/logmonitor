"use client";

import { useState, useRef, useEffect } from "react";
import { Palette, Check } from "lucide-react";
import { THEMES } from "@/lib/themes";
import { useTheme } from "@/components/ThemeProvider";

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const active = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Change theme"
        aria-label="Change theme"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.45rem 0.7rem",
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--ink-secondary)",
          cursor: "pointer",
          fontSize: "0.8rem",
        }}
      >
        <Palette size={15} />
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: active.swatch,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 0.5rem)",
            zIndex: 50,
            minWidth: 180,
            maxHeight: 340,
            overflowY: "auto",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "0.4rem",
            boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
            backdropFilter: "blur(12px)",
          }}
        >
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="menuitem"
              type="button"
              onClick={() => {
                setTheme(t.id);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                width: "100%",
                padding: "0.45rem 0.6rem",
                borderRadius: 8,
                border: "none",
                background: t.id === theme ? "var(--surface-2)" : "transparent",
                color: "var(--ink)",
                cursor: "pointer",
                fontSize: "0.85rem",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: t.swatch,
                  display: "inline-block",
                  flexShrink: 0,
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              />
              <span style={{ flex: 1 }}>{t.label}</span>
              {t.id === theme && <Check size={14} style={{ color: "var(--primary)" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
