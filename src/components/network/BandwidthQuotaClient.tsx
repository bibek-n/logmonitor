"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Badge } from "@/components/ui/Badge";
import { parseJsonResponse } from "@/lib/apiFetch";

interface Settings {
  dailyCapGb: number | null;
  enabled: boolean;
}

interface Breach {
  name: string;
  ipAddresses: string[];
  totalBytes: number;
  capBytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = -1;
  do {
    value /= 1024;
    i++;
  } while (value >= 1024 && i < units.length - 1);
  return `${value.toFixed(1)} ${units[i]}`;
}

export function BandwidthQuotaClient({ initialSettings, initialBreaches }: { initialSettings: Settings; initialBreaches: Breach[] }) {
  const [capGb, setCapGb] = useState(initialSettings.dailyCapGb?.toString() ?? "10");
  const [enabled, setEnabled] = useState(initialSettings.enabled);
  const [breaches, setBreaches] = useState(initialBreaches);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/network/bandwidth-quota", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyCapGb: Number(capGb), enabled }),
      });
      if (!res.ok) throw new Error();
      await handleRefresh(enabled);
    } catch {
      // Keep the form values as the admin set them even on failure - a retry is a Save click away.
    } finally {
      setSaving(false);
    }
  }

  async function handleRefresh(isEnabled: boolean) {
    if (!isEnabled) {
      setBreaches([]);
      return;
    }
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/network/bandwidth-quota?hours=24");
      const data = (await parseJsonResponse(res)) as { ok: boolean; breaches?: Breach[] };
      if (data.ok && data.breaches) setBreaches(data.breaches);
    } catch {
      // Keep showing the last-known breach list on a transient failure.
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onChange={setEnabled} />
            <span style={{ fontSize: "0.85rem" }}>Monitor daily bandwidth caps</span>
          </div>
          <div className="flex items-center gap-2">
            <label style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>Daily cap per staff member</label>
            <input
              type="number"
              min={0.1}
              step={0.5}
              value={capGb}
              onChange={(e) => setCapGb(e.target.value)}
              style={{ width: 90, padding: "0.4rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)" }}
            />
            <span style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>GB</span>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between" style={{ marginBottom: "0.75rem" }}>
          <h2 style={{ fontSize: "1rem", margin: 0 }}>Who would have been capped (last 24h)</h2>
          <Button size="sm" variant="secondary" onClick={() => handleRefresh(enabled)} disabled={refreshing || !enabled}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
        {!enabled ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Enable monitoring above to see breaches here.</p>
        ) : breaches.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Nobody has exceeded the cap in the last 24 hours.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Staff</th>
                  <th style={{ padding: "0.4rem" }}>IP Addresses</th>
                  <th style={{ padding: "0.4rem" }}>Used</th>
                  <th style={{ padding: "0.4rem" }}>Cap</th>
                  <th style={{ padding: "0.4rem" }} />
                </tr>
              </thead>
              <tbody>
                {breaches.map((b) => (
                  <tr key={b.name} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>{b.name}</td>
                    <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{b.ipAddresses.join(", ")}</td>
                    <td style={{ padding: "0.4rem" }}>{formatBytes(b.totalBytes)}</td>
                    <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{formatBytes(b.capBytes)}</td>
                    <td style={{ padding: "0.4rem" }}>
                      <Badge tone="warning">Would be capped</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
