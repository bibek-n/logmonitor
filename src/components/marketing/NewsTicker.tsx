"use client";

import { Flame } from "lucide-react";
import { MKT } from "@/lib/marketingTheme";
import { useLiveFeed } from "@/hooks/useLiveFeed";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string | null;
}

const REFRESH_MS = 15 * 60 * 1000;

// Refetches on mount, on a 15-minute interval, and whenever the tab regains focus (see
// useLiveFeed) — a failed refresh keeps whatever was already showing rather than blanking
// the ticker.
export function NewsTicker() {
  const { items, loading } = useLiveFeed<NewsItem>("/api/public/news", REFRESH_MS);

  if (loading && items.length === 0) {
    return (
      <div style={{ background: MKT.ink, color: "rgba(255,255,255,0.7)", padding: "0.4rem 0.9rem", fontSize: "0.8rem" }}>
        Loading latest news...
      </div>
    );
  }

  if (items.length === 0) return null;

  // Duplicated once so the CSS marquee can loop seamlessly (the animation slides exactly
  // -50%, so the duplicate picks up right where the original left off).
  const trackItems = [...items, ...items];

  return (
    <div
      style={{
        background: MKT.ink,
        color: "#fff",
        overflow: "hidden",
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        fontSize: "0.8rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          background: MKT.primary,
          padding: "0.4rem 0.9rem",
          fontWeight: 700,
          flexShrink: 0,
          zIndex: 1,
        }}
      >
        <Flame size={14} />
        HOT NEWS
      </div>
      <div style={{ overflow: "hidden", flex: 1 }}>
        <div className="news-ticker-track" style={{ display: "inline-flex", alignItems: "center" }}>
          {trackItems.map((item, i) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noreferrer noopener"
              style={{ color: "#fff", textDecoration: "none", padding: "0.4rem 1.5rem", flexShrink: 0 }}
            >
              {item.title}
            </a>
          ))}
        </div>
      </div>
      <style>{`
        .news-ticker-track {
          animation: news-ticker-scroll 45s linear infinite;
        }
        @keyframes news-ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
