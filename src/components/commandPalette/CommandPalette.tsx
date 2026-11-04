"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, User, Globe2, LayoutGrid, BookOpen, Siren } from "lucide-react";
import { SEARCH_INDEX } from "@/lib/navRoutes";
import type { SearchResult } from "@/app/api/admin/search/route";

interface Item {
  key: string;
  label: string;
  sublabel: string | null;
  href: string;
  icon: typeof LayoutGrid;
}

// Reuses navRoutes.ts's own SEARCH_INDEX (built from the same NAV_CATEGORIES the sidebar
// renders) instead of a hand-maintained parallel list - a hand-written route list here
// already drifted out of sync with the real nav once (missing several newer modules), and a
// derived index can't drift since it's the same source of truth the sidebar itself uses.
function routeToItem(r: (typeof SEARCH_INDEX)[number]): Item {
  return { key: `route:${r.href}`, label: r.label, sublabel: r.group, href: r.href, icon: LayoutGrid };
}

const SEARCH_RESULT_ICON: Record<SearchResult["type"], typeof LayoutGrid> = {
  staff: User,
  website: Globe2,
  "kb-doc": BookOpen,
  incident: Siren,
};

function searchResultToItem(r: SearchResult): Item {
  return { key: `${r.type}:${r.id}`, label: r.label, sublabel: r.sublabel, href: r.href, icon: SEARCH_RESULT_ICON[r.type] };
}

// Global Ctrl+K / Cmd+K "go to anything" palette - mounted once in DashShellClient so it
// works from every dashboard page without each page wiring it up itself. Matches static
// pages locally (instant) and live-searches staff/websites by name via /api/admin/search
// once the query is 2+ characters (debounced) - fast local results stay visible immediately,
// server results are appended once they arrive rather than replacing the list.
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [serverResults, setServerResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setServerResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setServerResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (!cancelled && data.ok) setServerResults(data.results);
      } catch {
        // Silent - the local static-route matches below still work without live search.
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  const q = query.trim().toLowerCase();
  const localMatches =
    q.length === 0
      ? SEARCH_INDEX.slice(0, 8)
      : SEARCH_INDEX.filter((r) => r.label.toLowerCase().includes(q) || r.group.toLowerCase().includes(q));
  const items: Item[] = [...localMatches.slice(0, 20).map(routeToItem), ...serverResults.map(searchResultToItem)];

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length, query]);

  function go(item: Item) {
    setOpen(false);
    router.push(item.href);
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center p-4"
      style={{ paddingTop: "12vh", background: "rgba(2,6,23,0.55)", backdropFilter: "blur(2px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        className="w-full rounded-2xl border flex flex-col"
        style={{ maxWidth: 560, maxHeight: "60vh", background: "var(--surface)", borderColor: "var(--border)", boxShadow: "0 24px 60px rgba(0,0,0,0.35)" }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && items[activeIndex]) {
            e.preventDefault();
            go(items[activeIndex]);
          }
        }}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <Search size={16} style={{ color: "var(--ink-muted)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Go to a page, staff member, website, KB doc, or incident..."
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--ink)", fontSize: "0.95rem" }}
          />
          <kbd style={{ fontSize: "0.7rem", color: "var(--ink-muted)", border: "1px solid var(--border)", borderRadius: 4, padding: "0.1rem 0.4rem" }}>Esc</kbd>
        </div>
        <div style={{ overflowY: "auto", padding: "0.4rem" }}>
          {items.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", padding: "0.75rem" }}>No matches.</p>
          ) : (
            items.map((item, i) => (
              <button
                key={item.key}
                onClick={() => go(item)}
                onMouseEnter={() => setActiveIndex(i)}
                className="flex items-center gap-3 w-full text-left"
                style={{
                  padding: "0.55rem 0.75rem",
                  borderRadius: 10,
                  background: i === activeIndex ? "color-mix(in srgb, var(--primary) 14%, transparent)" : "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--ink)",
                }}
              >
                <item.icon size={15} style={{ color: "var(--ink-muted)", flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</div>
                  {item.sublabel && <div style={{ fontSize: "0.74rem", color: "var(--ink-muted)" }}>{item.sublabel}</div>}
                </span>
                {i === activeIndex && <CornerDownLeft size={13} style={{ color: "var(--ink-muted)", flexShrink: 0 }} />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
