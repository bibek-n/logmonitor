"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Globe } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { OfflineWebsite } from "@/lib/dashboardLayouts/queries";

// Fetched and polled client-side (same pattern as TotalBandwidthCard) rather than folded into
// the Overview page's SSR Promise.all, so this widget refreshes every 2 minutes on its own
// without needing a full page reload.
const REFRESH_MS = 2 * 60 * 1000;

export function OfflineWebsitesCard() {
  const [websites, setWebsites] = useState<OfflineWebsite[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/dashboard/offline-websites");
        const data = await res.json();
        if (!cancelled && data.ok) setWebsites(data.data);
      } catch {
        // keep showing the last-known list rather than clearing it on a transient failure
      }
    }
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <Card className="h-full" hoverLift tilt3d>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.6rem" }}>
        <div className="flex items-center gap-2">
          <Globe size={16} style={{ color: websites && websites.length > 0 ? "var(--danger)" : "var(--ink-muted)" }} />
          <h2 style={{ fontSize: "1.125rem", margin: 0 }}>Offline Websites</h2>
        </div>
        <Link href="/dashboard/monitoring/websites" style={{ fontSize: "0.78rem", color: "var(--primary)" }}>
          View all &rarr;
        </Link>
      </div>
      {!websites ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>Loading...</p>
      ) : websites.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>Every monitored website is up.</p>
      ) : (
        <div className="ov-scroll flex flex-col gap-2" style={{ maxHeight: 320, overflowY: "auto" }}>
          {websites.map((w) => (
            <div key={w.id} style={{ fontSize: "0.8rem" }}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className={`status-dot status-${w.status === "Down" ? "critical" : "warning"}`} />
                  {w.name}
                </span>
                <Badge tone={w.status === "Down" ? "danger" : "warning"}>{w.status}</Badge>
              </div>
              <div style={{ color: "var(--ink-muted)", fontSize: "0.72rem", marginTop: "0.15rem", marginLeft: "1.1rem" }}>
                {w.url ? (
                  <a href={w.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }} onClick={(e) => e.stopPropagation()}>
                    {w.url}
                  </a>
                ) : (
                  "-"
                )}
                {w.lastError && ` - ${w.lastError}`}
                {w.httpStatusCode != null && ` (HTTP ${w.httpStatusCode})`}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
