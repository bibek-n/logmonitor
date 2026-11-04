"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { StaffOnlineStatus } from "@/app/api/admin/active-directory/users/ping-status/route";

// Live online/offline status for the Staff widget, using the same unified staffStatus source
// (agent heartbeat > MikroTik/Sophos network presence) as the Staff page itself - see the
// route's own comment for why this replaced a narrower AD-synced/raw-ping check. Fetched
// client-side (see the route's own comment) so this doesn't add latency to the Overview page's
// SSR load. Refreshes on an interval like the Cameras page's live status polling (see
// CamerasClient) rather than once per mount.
const REFRESH_MS = 60 * 1000;

export function ActiveDirectoryStatusCard() {
  const [users, setUsers] = useState<StaffOnlineStatus[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/active-directory/users/ping-status");
        const data = await res.json();
        if (!cancelled && data.ok) setUsers(data.users);
      } catch {
        // keep showing the last-known list rather than clearing it on a transient failure
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const onlineCount = users?.filter((u) => u.online).length ?? 0;
  // Offline first - those are the ones worth noticing, and with a growing staff list they'd
  // otherwise get buried past the fold under everyone who's simply online.
  const sortedUsers = users ? [...users].sort((a, b) => Number(a.online) - Number(b.online) || a.name.localeCompare(b.name)) : null;

  return (
    <Card className="h-full" hoverLift tilt3d>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.6rem" }}>
        <div className="flex items-center gap-2">
          <Users size={16} style={{ color: onlineCount > 0 ? "var(--good)" : "var(--ink-muted)" }} />
          <h2 style={{ fontSize: "1.125rem", margin: 0 }}>Staff</h2>
        </div>
        <Link href="/dashboard/staff" style={{ fontSize: "0.78rem", color: "var(--primary)" }}>
          View all &rarr;
        </Link>
      </div>
      <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", margin: "0 0 0.6rem" }}>
        {users && !loading ? `${onlineCount} of ${users.length} online now` : "Checking staff status..."}
      </p>
      {!users ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>Checking staff status...</p>
      ) : users.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>No active staff yet.</p>
      ) : (
        <div className="ov-scroll flex flex-col gap-2" style={{ maxHeight: 320, overflowY: "auto" }}>
          {sortedUsers!.map((u) => (
            <div key={u.id} className="flex items-center justify-between" style={{ fontSize: "0.8rem" }}>
              <span className="flex items-center gap-2">
                <span className={`status-dot status-${u.online ? "good" : "critical"}`} />
                {u.name}
                <span style={{ color: "var(--ink-muted)", fontSize: "0.72rem" }}>{u.ipAddress ?? "-"}</span>
              </span>
              <span style={{ color: u.online ? "var(--good)" : "var(--critical)" }}>{u.online ? "Online" : "Offline"}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
