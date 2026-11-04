"use client";

import { useEffect, useState } from "react";
import { Wifi } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { WifiUser } from "@/lib/dashboardLayouts/queries";

// Fetched and polled client-side (same pattern as TotalBandwidthCard) rather than folded into
// the Overview page's SSR Promise.all, so this widget can refresh independently on its own
// 1-hour cadence without forcing every other widget on the page to refetch too. Each poll runs
// the underlying query fresh (see getWifiUsers), so the data shown is always current as of the
// moment it's fetched - "real-time" here means "not cached/stale data", not that updates push
// faster than the poll interval.
const REFRESH_MS = 60 * 60 * 1000;

export function WifiUsersCard() {
  const [users, setUsers] = useState<WifiUser[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/dashboard/wifi-users");
        const data = await res.json();
        if (!cancelled && data.ok) setUsers(data.data);
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
          <Wifi size={16} style={{ color: users && users.length > 0 ? "var(--success)" : "var(--ink-muted)" }} />
          <h2 style={{ fontSize: "1.125rem", margin: 0 }}>WiFi Users</h2>
        </div>
      </div>
      <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", margin: "0 0 0.6rem" }}>
        Online right now - MikroTik + Sophos, combined - refreshes hourly
      </p>
      {!users ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>Loading...</p>
      ) : users.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>No devices currently online.</p>
      ) : (
        <div className="ov-scroll flex flex-col gap-2" style={{ maxHeight: 320, overflowY: "auto" }}>
          {users.map((u) => (
            <div key={u.mac} className="flex items-center justify-between" style={{ fontSize: "0.8rem" }}>
              <span style={{ minWidth: 0 }}>
                <span>{u.name ?? "Unknown"}</span>
                <span style={{ color: "var(--ink-muted)", fontSize: "0.72rem", marginLeft: "0.4rem" }}>
                  {u.mac} - {u.ip}
                </span>
              </span>
              <Badge tone={u.source === "MikroTik" ? "info" : "success"}>{u.source}</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
