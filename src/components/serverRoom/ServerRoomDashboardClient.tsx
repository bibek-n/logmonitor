"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { parseJsonResponse } from "@/lib/apiFetch";

interface Dash {
  entriesToday: number;
  activeEntries: number;
  completedTasksToday: number;
  completedTasksTotal: number;
  technicalToday: number;
  technicalOpen: number;
  hostingToday: number;
  hostingOpen: number;
  securityTasksToday: number;
  securityTasksOpen: number;
  openIncidents: number;
  pendingSecurityUpdates: number;
  criticalUpdates: number;
  failedUpdates: number;
  windowsUpdates: number;
  macosUpdates: number;
  linuxUpdates: number;
  devicesScanned: number;
  devicesTotal: number;
}

function Tile({ label, value, sub, tone, href }: { label: string; value: number | string; sub?: string; tone?: "danger" | "warning" | "success"; href?: string }) {
  const color = tone === "danger" ? "var(--danger)" : tone === "warning" ? "var(--warning)" : tone === "success" ? "var(--success)" : "var(--ink)";
  const body = (
    <Card className="flex flex-col gap-1" style={{ minWidth: 200 }}>
      <span style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>{label}</span>
      <span style={{ fontSize: "1.9rem", fontWeight: 600, color }}>{value}</span>
      {sub && <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>{sub}</span>}
    </Card>
  );
  return href ? (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      {body}
    </Link>
  ) : (
    body
  );
}

export function ServerRoomDashboardClient() {
  const toast = useToast();
  const [d, setD] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/server-room/dashboard");
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string; data?: Dash };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load the dashboard");
      setD(json.data ?? null);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to load the dashboard." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !d) return <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>Loading...</p>;
  if (!d) return <p style={{ fontSize: "0.85rem", color: "var(--danger)" }}>Could not load the dashboard.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="secondary" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <h2 style={{ fontSize: "1rem", margin: 0 }}>Server room</h2>
      <div className="flex flex-wrap gap-3">
        <Tile label="Server Room Entries Today" value={d.entriesToday} href="/dashboard/server-room/entries" />
        <Tile label="Active Entries" value={d.activeEntries} sub="people inside right now" tone={d.activeEntries > 0 ? "warning" : "success"} href="/dashboard/server-room/entries" />
        <Tile label="Completed Tasks" value={d.completedTasksToday} sub={`today - ${d.completedTasksTotal} in total`} tone="success" href="/dashboard/server-room/tasks" />
        <Tile label="Technical Support Tasks" value={d.technicalToday} sub={`today - ${d.technicalOpen} in progress`} href="/dashboard/server-room/tasks" />
        <Tile label="Website Hosting Tasks" value={d.hostingToday} sub={`today - ${d.hostingOpen} in progress`} href="/dashboard/server-room/tasks" />
        <Tile label="Security Update Tasks" value={d.securityTasksToday} sub={`today - ${d.securityTasksOpen} in progress`} href="/dashboard/server-room/tasks" />
        <Tile label="Open Incidents" value={d.openIncidents} tone={d.openIncidents > 0 ? "danger" : "success"} href="/dashboard/server-room/incidents" />
      </div>

      <h2 style={{ fontSize: "1rem", margin: 0 }}>Security &amp; updates</h2>
      <div className="flex flex-wrap gap-3">
        <Tile label="Pending Security Updates" value={d.pendingSecurityUpdates} tone={d.pendingSecurityUpdates > 0 ? "danger" : "success"} href="/dashboard/security-updates/devices?status=needs" />
        <Tile label="Critical Updates" value={d.criticalUpdates} tone={d.criticalUpdates > 0 ? "danger" : "success"} href="/dashboard/security-updates/devices?status=needs" />
        <Tile label="Failed Updates" value={d.failedUpdates} tone={d.failedUpdates > 0 ? "warning" : "success"} href="/dashboard/security-updates/devices?status=failed" />
        <Tile label="Windows Updates" value={d.windowsUpdates} href="/dashboard/security-updates" />
        <Tile label="macOS Updates" value={d.macosUpdates} href="/dashboard/security-updates" />
        <Tile label="Linux Updates" value={d.linuxUpdates} href="/dashboard/security-updates" />
        <Tile label="Devices Scanned" value={`${d.devicesScanned} / ${d.devicesTotal}`} href="/dashboard/security-updates/devices" />
      </div>
    </div>
  );
}
