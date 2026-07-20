"use client";

import { Sparkles } from "lucide-react";
import { MKT } from "@/lib/marketingTheme";
import { useLiveFeed } from "@/hooks/useLiveFeed";

interface DevNewsItem {
  title: string;
  link: string;
  pubDate: string | null;
  source: string;
}

const REFRESH_MS = 30 * 60 * 1000;

// Refetches on mount, on a 30-minute interval, and whenever the tab regains focus (see
// useLiveFeed) — a failed refresh keeps whatever was already showing rather than blanking
// the widget.
export function DevAiNewsWidget() {
  const { items, loading } = useLiveFeed<DevNewsItem>("/api/public/dev-ai-news", REFRESH_MS);

  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${MKT.border}`,
        borderRadius: 12,
        padding: "1.25rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: "0.9rem" }}>
        <Sparkles size={17} style={{ color: MKT.primary }} />
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: MKT.ink, margin: 0 }}>Dev &amp; AI Hot News</h3>
      </div>

      {loading ? (
        <p style={{ fontSize: "0.8rem", color: MKT.inkMuted }}>Loading latest news...</p>
      ) : items.length === 0 ? (
        <p style={{ fontSize: "0.8rem", color: MKT.inkMuted }}>No news available right now.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {items.map((item, i) => (
            <li key={i} style={{ borderBottom: i < items.length - 1 ? `1px solid ${MKT.border}` : "none", paddingBottom: "0.75rem" }}>
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer noopener"
                style={{ color: MKT.ink, textDecoration: "none", fontSize: "0.85rem", fontWeight: 500, lineHeight: 1.4 }}
              >
                {item.title}
              </a>
              <div style={{ fontSize: "0.72rem", color: MKT.inkMuted, marginTop: "0.25rem" }}>
                {item.source}
                {item.pubDate && ` · ${new Date(item.pubDate).toLocaleDateString()}`}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
