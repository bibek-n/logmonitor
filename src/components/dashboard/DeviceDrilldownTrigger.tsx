"use client";

import { ReactNode, useState, useEffect, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { SidePanel } from "@/components/ui/SidePanel";
import { Badge } from "@/components/ui/Badge";

interface MetricPoint {
  t: string;
  cpu: number | null;
  mem: number | null;
  disk: number | null;
}
interface BlockedEvent {
  receivedAt: string;
  source: "threat" | "webfilter";
  blocked: boolean;
  detail: string;
}
interface DrilldownData {
  ok: boolean;
  ip: string;
  device: { deviceId: string; name: string } | null;
  macAddress: string | null;
  metrics: MetricPoint[];
  dhcpLease: { hostname: string | null; status: string | null; lastSeen: string | null; expiresAfter: string | null } | null;
  blockedEvents: BlockedEvent[];
}

function dlRow(label: string, value: ReactNode) {
  return (
    <div className="flex items-center justify-between" style={{ padding: "0.3rem 0", borderBottom: "1px solid var(--grid)" }}>
      <span style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>{label}</span>
      <span style={{ fontSize: "0.8rem", color: "var(--ink)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function DrilldownPanelBody({ ip }: { ip: string }) {
  const [data, setData] = useState<DrilldownData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetch(`/api/admin/network/drilldown?ip=${encodeURIComponent(ip)}&hours=4`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.ok) throw new Error(json.error ?? "Failed to load");
        setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong.");
      });
    return () => {
      cancelled = true;
    };
  }, [ip]);

  if (error) return <p style={{ color: "var(--danger)" }}>{error}</p>;
  if (!data) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.5rem" }}>
          {data.device?.name ?? data.dhcpLease?.hostname ?? data.ip}
        </h3>
        {dlRow("IP Address", data.ip)}
        {dlRow("MAC Address", data.macAddress ?? "Unknown")}
        {dlRow("DHCP Status", data.dhcpLease?.status ?? "No lease on record")}
        {data.dhcpLease?.expiresAfter && dlRow("Lease Expires", data.dhcpLease.expiresAfter)}
      </div>

      <div>
        <h4 style={{ fontSize: "0.85rem", margin: "0 0 0.5rem", color: "var(--ink-muted)" }}>CPU / Memory / Disk</h4>
        {data.metrics.length < 2 ? (
          <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
            {data.device ? "Not enough metrics history yet." : "No agent enrolled on this IP - no metrics history available."}
          </p>
        ) : (
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.metrics} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="t" tickFormatter={(v) => new Date(v).toLocaleTimeString()} stroke="var(--ink-muted)" fontSize={10} tickLine={false} />
                <YAxis stroke="var(--ink-muted)" fontSize={10} tickLine={false} width={32} unit="%" />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.78rem" }}
                  labelFormatter={(v) => new Date(v).toLocaleString()}
                />
                <Legend wrapperStyle={{ fontSize: "0.72rem" }} />
                <Area type="monotone" dataKey="cpu" name="CPU %" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
                <Area type="monotone" dataKey="mem" name="Memory %" stroke="var(--success)" fill="var(--success)" fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
                <Area type="monotone" dataKey="disk" name="Disk %" stroke="var(--warning)" fill="var(--warning)" fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div>
        <h4 style={{ fontSize: "0.85rem", margin: "0 0 0.5rem", color: "var(--ink-muted)" }}>Sophos Activity (last 4h)</h4>
        {data.blockedEvents.length === 0 ? (
          <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>No threat or web-filter log entries for this IP.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.blockedEvents.map((e, i) => (
              <div key={i} className="flex items-start justify-between gap-2" style={{ fontSize: "0.78rem" }}>
                <span style={{ color: "var(--ink)" }}>{e.detail}</span>
                <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                  <Badge tone={e.blocked ? "danger" : "neutral"}>{e.blocked ? "Blocked" : "Info"}</Badge>
                  <span style={{ color: "var(--ink-muted)", whiteSpace: "nowrap" }}>{new Date(e.receivedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Wraps any row/element that represents a specific network host - clicking it opens the
// drill-down side panel for that IP. Self-contained (owns its own open state and data fetch)
// so it can be dropped into RightRail's Top 10 Most Active Devices rows and AlertsTable's
// rows identically without any shared state/context between them.
export function DeviceDrilldownTrigger({ ip, children }: { ip: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}
      >
        {children}
      </button>
      <SidePanel open={open} onClose={close} title="Device Details">
        {open && <DrilldownPanelBody ip={ip} />}
      </SidePanel>
    </>
  );
}
