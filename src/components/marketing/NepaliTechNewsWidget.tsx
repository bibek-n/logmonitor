"use client";

import { Newspaper } from "lucide-react";
import { MKT } from "@/lib/marketingTheme";
import { useLiveFeed } from "@/hooks/useLiveFeed";
import type { NepaliTechNewsItem } from "@/lib/nepaliTechNewsFeed";

const REFRESH_MS = 15 * 60 * 1000; // matches the feed's own server-side revalidate window

// Client Component fetching /api/public/nepali-tech-news — refetches on mount, on a 15-minute
// interval, and whenever the tab regains focus, so the widget never gets stuck showing
// day-old cached content (see useLiveFeed for details).
//
// Rendered as its own full-width section (a horizontal row of cards) rather than a narrow
// sidebar list — this needs the caller to render it outside the sidebar column.
export function NepaliTechNewsWidget() {
  const { items, loading } = useLiveFeed<NepaliTechNewsItem>("/api/public/nepali-tech-news", REFRESH_MS);

  if (!loading && items.length === 0) return null;

  return (
    <section style={{ padding: "0 1.25rem 3.5rem", maxWidth: 1200, margin: "0 auto" }}>
      <div className="flex items-center gap-2" style={{ marginBottom: "1.25rem" }}>
        <Newspaper size={20} style={{ color: MKT.primary }} />
        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: MKT.ink, margin: 0 }}>Nepali Tech News</h2>
      </div>

      {loading && items.length === 0 ? (
        <p style={{ fontSize: "0.85rem", color: MKT.inkMuted }}>Loading latest news...</p>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
          {items.map((item, i) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noreferrer noopener"
              style={{
                display: "block",
                background: "#fff",
                border: `1px solid ${MKT.border}`,
                borderRadius: 10,
                padding: "1rem",
                textDecoration: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                transition: "border-color 0.15s ease",
              }}
              className="hover:border-slate-300"
            >
              <div
                style={{
                  color: MKT.ink,
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  lineHeight: 1.4,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {item.title}
              </div>
              {item.pubDate && (
                <div style={{ fontSize: "0.74rem", color: MKT.inkMuted, marginTop: "0.5rem" }}>{new Date(item.pubDate).toLocaleDateString()}</div>
              )}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
