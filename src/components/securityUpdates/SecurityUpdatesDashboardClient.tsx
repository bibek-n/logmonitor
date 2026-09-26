"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { parseJsonResponse } from "@/lib/apiFetch";
import { formatUtcTimestamp } from "@/lib/formatUtcTimestamp";
import { th, td } from "./shared";

interface OsSummary {
  devices: number;
  scanned: number;
  withPending: number;
  updates: number;
  security: number;
  critical: number;
  failed: number;
  reboot: number;
}
interface Summary {
  totals: OsSummary;
  byOs: Record<string, OsSummary>;
  lastScanAt: string | null;
  outdatedAgents: number;
  neverScanned: number;
}

function Tile({ label, value, sub, tone, href }: { label: string; value: number | string; sub?: string; tone?: "danger" | "warning" | "success"; href?: string }) {
  const color = tone === "danger" ? "var(--danger)" : tone === "warning" ? "var(--warning)" : tone === "success" ? "var(--success)" : "var(--ink)";
  const body = (
    <Card className="flex flex-col gap-1" style={{ minWidth: 190 }}>
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

export function SecurityUpdatesDashboardClient({ canScan }: { canScan: boolean }) {
  const toast = useToast();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/security-updates/summary");
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string; data?: Summary };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load summary");
      setData(json.data ?? null);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to load summary." });
    } finally {
      setLoading(false);
    }
  }

  async function scanAll() {
    setScanning(true);
    try {
      const res = await fetch("/api/admin/security-updates/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string; queued?: number; skipped?: { reason: string }[] };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to queue scans");
      toast.show({
        type: "success",
        message: `Scan queued for ${json.queued ?? 0} device(s); ${json.skipped?.length ?? 0} skipped (offline or agent too old). Results appear within a minute or two.`,
      });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to queue scans." });
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !data) return <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>Loading...</p>;
  if (!data) return <p style={{ fontSize: "0.85rem", color: "var(--danger)" }}>Could not load the summary.</p>;

  const t = data.totals;
  const w = data.byOs.windows;
  const l = data.byOs.linux;
  const m = data.byOs.darwin;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
        {canScan && (
          <Button onClick={scanAll} disabled={scanning}>
            {scanning ? "Queuing..." : "Scan All"}
          </Button>
        )}
        <span style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>Last scan: {data.lastScanAt ? formatUtcTimestamp(data.lastScanAt) : "never"}</span>
      </div>

      <div className="flex flex-wrap gap-3">
        <Tile label="Pending Security Updates" value={t.security} tone={t.security > 0 ? "danger" : "success"} href="/dashboard/security-updates/devices?status=needs" />
        <Tile label="Critical Updates" value={t.critical} tone={t.critical > 0 ? "danger" : "success"} href="/dashboard/security-updates/devices?status=needs" />
        <Tile label="Failed Updates" value={t.failed} tone={t.failed > 0 ? "warning" : "success"} href="/dashboard/security-updates/devices?status=failed" />
        <Tile label="Restart Required" value={t.reboot} sub="devices" tone={t.reboot > 0 ? "warning" : "success"} href="/dashboard/security-updates/devices?status=reboot" />
        <Tile label="Windows Updates" value={w.updates} sub={`${w.withPending} of ${w.scanned} scanned devices`} />
        <Tile label="macOS Updates" value={m.updates} sub={`${m.withPending} of ${m.scanned} scanned devices`} />
        <Tile label="Linux Updates" value={l.updates} sub={`${l.withPending} of ${l.scanned} scanned devices`} />
        <Tile label="Devices Scanned" value={`${t.scanned} / ${t.devices}`} sub={`${data.neverScanned} never scanned`} href="/dashboard/security-updates/devices?status=never" />
        <Tile label="Agents To Upgrade" value={data.outdatedAgents} sub="online, too old to scan" tone={data.outdatedAgents > 0 ? "warning" : "success"} />
      </div>

      <Card className="flex flex-col gap-2">
        <h2 style={{ fontSize: "1rem", margin: 0 }}>By operating system</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                {["OS", "Devices", "Scanned", "With pending", "Pending updates", "Security", "Critical", "Failed", "Restart"].map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Windows", w],
                  ["macOS", m],
                  ["Linux", l],
                  ["Other", data.byOs.other],
                ] as [string, OsSummary][]
              ).map(([name, o]) => (
                <tr key={name} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={td}>{name}</td>
                  <td style={td}>{o.devices}</td>
                  <td style={td}>{o.scanned}</td>
                  <td style={td}>{o.withPending}</td>
                  <td style={td}>{o.updates}</td>
                  <td style={td}>{o.security}</td>
                  <td style={td}>{o.critical}</td>
                  <td style={td}>{o.failed}</td>
                  <td style={td}>{o.reboot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", margin: 0 }}>
          Counts come from each device&apos;s most recent scan. Server-room entries, tasks and incidents are added in the next phase.
        </p>
      </Card>
    </div>
  );
}
