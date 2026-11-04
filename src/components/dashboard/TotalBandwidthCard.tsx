"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gauge, ArrowDown, ArrowUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatBytes } from "@/components/dashboard/ExtraWidgets";
import type { CurrentBandwidthRate } from "@/lib/topConsumers";

// Fetched and polled client-side (same pattern as ActiveDirectoryStatusCard) rather than folded
// into the Overview page's SSR Promise.all, so this one widget can refresh on its own without
// forcing every other widget on the page to refetch too. Polled every 5s.
const REFRESH_MS = 5 * 1000;

function formatRate(bytesPerSecond: number): string {
  return `${formatBytes(Math.round(bytesPerSecond))}/s`;
}

export function TotalBandwidthCard() {
  const [bandwidth, setBandwidth] = useState<CurrentBandwidthRate | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/dashboard/total-bandwidth");
        const data = await res.json();
        if (!cancelled && data.ok && data.data) setBandwidth(data.data);
      } catch {
        // keep showing the last-known rate rather than clearing it on a transient failure
      }
    }
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const totalBps = bandwidth ? bandwidth.incomingBps + bandwidth.outgoingBps : 0;
  const isEstimate = bandwidth?.source === "webfilter";

  return (
    <Card className="h-full" hoverLift tilt3d>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.6rem" }}>
        <div className="flex items-center gap-2">
          <Gauge size={16} />
          <h2 style={{ fontSize: "1.125rem", margin: 0 }}>Total Bandwidth - Sophos Firewall</h2>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: isEstimate ? "var(--warning, #f59e0b)" : "var(--success, #22c55e)",
              display: "inline-block",
            }}
            title={
              isEstimate
                ? "Firewall hasn't reported WAN interface usage recently - showing a 5-min HTTP-traffic-only average"
                : "Live - firewall-reported WAN throughput, updates every 5s"
            }
          />
        </div>
        <Link href="/dashboard/top-consumers" style={{ fontSize: "0.78rem", color: "var(--primary)" }}>
          View all &rarr;
        </Link>
      </div>
      {isEstimate && (
        <p style={{ color: "var(--warning, #f59e0b)", fontSize: "0.75rem", marginBottom: "0.4rem" }}>
          Firewall interface data unavailable - showing a 5-min average from HTTP/HTTPS traffic only (undercounts non-web traffic).
        </p>
      )}
      {!bandwidth ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>Loading...</p>
      ) : totalBps === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>No traffic right now.</p>
      ) : (
        <div className="flex items-center gap-4" style={{ flexWrap: "wrap" }}>
          <div className="flex items-center gap-2" style={{ fontSize: "0.85rem" }}>
            <ArrowDown size={16} style={{ color: "var(--success, #22c55e)" }} />
            <span style={{ color: "var(--ink-muted)" }}>Incoming</span>
            <span style={{ fontWeight: 600 }}>{formatRate(bandwidth.incomingBps)}</span>
          </div>
          <div className="flex items-center gap-2" style={{ fontSize: "0.85rem" }}>
            <ArrowUp size={16} style={{ color: "var(--primary)" }} />
            <span style={{ color: "var(--ink-muted)" }}>Outgoing</span>
            <span style={{ fontWeight: 600 }}>{formatRate(bandwidth.outgoingBps)}</span>
          </div>
          <div className="flex items-center gap-2" style={{ fontSize: "0.85rem" }}>
            <span style={{ color: "var(--ink-muted)" }}>Total</span>
            <span style={{ fontWeight: 600 }}>{formatRate(totalBps)}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
