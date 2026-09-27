"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface RecentChange {
  Id: number;
  Username: string;
  Action: string;
  Details: string | null;
  CreatedAt: string;
}

interface SyncStatusRow {
  Status: string;
  Cnt: number;
}

interface Summary {
  totalStaff: number;
  allowedWebsites: number;
  blockedWebsites: number;
  staffGroups: number;
  criticalApplications: number;
  recentPolicyChanges: RecentChange[];
  sophosSyncStatus: SyncStatusRow[];
}

const STAT_CARDS: { key: keyof Summary; label: string; href: string }[] = [
  { key: "totalStaff", label: "Total Staff", href: "/dashboard/web-access-control/groups" },
  { key: "allowedWebsites", label: "Allowed Websites (rules)", href: "/dashboard/web-access-control/rules?scopeType=&action=Allow" },
  { key: "blockedWebsites", label: "Blocked Websites (rules)", href: "/dashboard/web-access-control/rules?scopeType=&action=Block" },
  { key: "staffGroups", label: "Staff Groups", href: "/dashboard/web-access-control/groups" },
  { key: "criticalApplications", label: "Critical Applications", href: "/dashboard/web-access-control/allowlist" },
];

export function WacDashboardClient() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/web-access-control/dashboard-summary");
      const data = await res.json();
      if (res.ok && data.ok) setSummary(data.data);
    })();
  }, []);

  const failedOrNotConnected = summary?.sophosSyncStatus.filter((s) => s.Status === "NotConnected" || s.Status === "Failed").reduce((sum, s) => sum + s.Cnt, 0) ?? 0;
  const synced = summary?.sophosSyncStatus.find((s) => s.Status === "Synced")?.Cnt ?? 0;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.85rem", marginBottom: "1.25rem" }}>
        {STAT_CARDS.map((c) => (
          <Link key={c.key} href={c.href} style={{ textDecoration: "none", color: "inherit" }}>
            <Card style={{ cursor: "pointer" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)", marginBottom: "0.4rem" }}>{c.label}</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--ink)" }}>{summary ? summary[c.key] as number : "—"}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem", alignItems: "start" }}>
        <Card>
          <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.75rem" }}>Recent Policy Changes</h2>
          {!summary ? (
            <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
          ) : summary.recentPolicyChanges.length === 0 ? (
            <p style={{ color: "var(--ink-muted)" }}>No changes recorded yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                    <th style={{ padding: "0.4rem" }}>When</th>
                    <th style={{ padding: "0.4rem" }}>User</th>
                    <th style={{ padding: "0.4rem" }}>Action</th>
                    <th style={{ padding: "0.4rem" }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentPolicyChanges.map((c) => (
                    <tr key={c.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(c.CreatedAt + "Z").toLocaleString()}</td>
                      <td style={{ padding: "0.4rem" }}>{c.Username}</td>
                      <td style={{ padding: "0.4rem" }}>{c.Action}</td>
                      <td style={{ padding: "0.4rem", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.Details ?? ""}>
                        {c.Details ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.5rem" }}>Sophos Synchronization Status</h2>
          <div style={{ marginBottom: "0.6rem" }}>
            <Badge tone="neutral">Not Connected</Badge>
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", lineHeight: 1.5, margin: 0 }}>
            No Sophos Firewall admin API connection has been configured yet. Rules created here are fully stored and
            enforceable within this app; pushing them to the physical firewall requires verified Sophos API
            credentials that are not yet available. Use the &quot;Sync to Sophos&quot; button on a rule to see the
            live (currently &quot;not connected&quot;) status honestly rather than a placeholder success.
          </p>
          {summary && (synced > 0 || failedOrNotConnected > 0) && (
            <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginTop: "0.6rem" }}>
              {synced} synced - {failedOrNotConnected} not connected / failed (from the last sync attempt per rule).
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
