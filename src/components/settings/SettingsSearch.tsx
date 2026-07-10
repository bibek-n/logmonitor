"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { SETTINGS_SEARCH_INDEX } from "@/lib/settingsSearchIndex";

export function SettingsSearch({ onNavigate }: { onNavigate: (section: string, fieldId: string) => void }) {
  const t = useTranslations("settings.search");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return SETTINGS_SEARCH_INDEX.filter((e) => e.label.toLowerCase().includes(q)).slice(0, 12);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function select(sectionKey: string, fieldId: string) {
    onNavigate(sectionKey, fieldId);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} style={{ position: "relative", maxWidth: 340, width: "100%" }}>
      <div className="flex items-center gap-2" style={{ padding: "0.5rem 0.7rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
        <Search size={15} color="var(--ink-muted)" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={t("placeholder")}
          style={{ border: "none", outline: "none", background: "none", color: "var(--ink)", fontSize: "0.85rem", width: "100%" }}
        />
      </div>
      {open && results.length > 0 && (
        <div
          className="flex flex-col"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 40,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 12px 28px rgba(0,0,0,0.25)",
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {results.map((r, i) => (
            <button
              key={`${r.section}-${r.id}-${i}`}
              onClick={() => select(r.section, r.id)}
              style={{
                textAlign: "left",
                padding: "0.5rem 0.75rem",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "0.82rem",
                color: "var(--ink)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {r.label}
              <span style={{ color: "var(--ink-muted)", marginLeft: 8, fontSize: "0.72rem" }}>{r.section.replace(/-/g, " ")}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
