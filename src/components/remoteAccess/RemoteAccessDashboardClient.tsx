"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface Connection {
  id: number;
  name: string;
  protocol: string;
  environment: string;
  operatingSystem: string | null;
  availabilityStatus: string;
  isFavorite: boolean;
}

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  Online: "success",
  Offline: "danger",
  Degraded: "warning",
  Unknown: "neutral",
};

function countBy<T extends string>(items: T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[item] = (counts[item] ?? 0) + 1;
  return counts;
}

export function RemoteAccessDashboardClient() {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [sessions, setSessions] = useState<{ id: number; status: string }[] | null>(null);

  const load = useCallback(async () => {
    const [connRes, sessionRes] = await Promise.all([fetch("/api/admin/remote-access/connections"), fetch("/api/admin/remote-access/sessions")]);
    const connData = await connRes.json();
    const sessionData = await sessionRes.json();
    if (connRes.ok && connData.ok) setConnections(connData.data);
    if (sessionRes.ok && sessionData.ok) setSessions(sessionData.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!connections || !sessions) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  const statusCounts = countBy(connections.map((c) => c.availabilityStatus));
  const protocolCounts = countBy(connections.map((c) => c.protocol));
  const environmentCounts = countBy(connections.map((c) => c.environment));
  const activeSessions = sessions.filter((s) => s.status === "Active");
  const favorites = connections.filter((c) => c.isFavorite);

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <Link href="/dashboard/remote-access/connections/new" className="dash-panel" style={quickActionStyle}>
          + New Connection
        </Link>
        <Link href="/dashboard/remote-access/quick-connect" className="dash-panel" style={quickActionStyle}>
          Quick Connect
        </Link>
        <Link href="/dashboard/remote-access/terminal" className="dash-panel" style={quickActionStyle}>
          Open Terminal
        </Link>
        <Link href="/dashboard/remote-access/file-transfer" className="dash-panel" style={quickActionStyle}>
          File Transfer
        </Link>
        <Link href="/dashboard/remote-access/inventory" className="dash-panel" style={quickActionStyle}>
          Server Inventory
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
        <Card>
          <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>Total Connections</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{connections.length}</div>
        </Card>
        <Card>
          <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>Online</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--success)" }}>{statusCounts.Online ?? 0}</div>
        </Card>
        <Card>
          <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>Offline</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--danger)" }}>{statusCounts.Offline ?? 0}</div>
        </Card>
        <Card>
          <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>Unknown</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--ink-muted)" }}>{statusCounts.Unknown ?? 0}</div>
        </Card>
        <Card>
          <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>Active Sessions</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--info)" }}>{activeSessions.length}</div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
        <Card>
          <h3 style={{ marginTop: 0, fontSize: "0.9rem" }}>By Protocol</h3>
          {Object.entries(protocolCounts).map(([protocol, count]) => (
            <div key={protocol} style={{ display: "flex", justifyContent: "space-between", padding: "0.2rem 0", fontSize: "0.85rem" }}>
              <span>{protocol}</span>
              <span>{count}</span>
            </div>
          ))}
        </Card>
        <Card>
          <h3 style={{ marginTop: 0, fontSize: "0.9rem" }}>By Environment</h3>
          {Object.entries(environmentCounts).map(([env, count]) => (
            <div key={env} style={{ display: "flex", justifyContent: "space-between", padding: "0.2rem 0", fontSize: "0.85rem" }}>
              <span>{env}</span>
              <span>{count}</span>
            </div>
          ))}
        </Card>
        <Card>
          <h3 style={{ marginTop: 0, fontSize: "0.9rem" }}>Favorites</h3>
          {favorites.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No favorites yet.</p>
          ) : (
            favorites.map((f) => (
              <div key={f.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.2rem 0", fontSize: "0.85rem" }}>
                <Link href={`/dashboard/remote-access/connections/${f.id}/edit`}>{f.name}</Link>
                <Badge tone={STATUS_TONE[f.availabilityStatus] ?? "neutral"}>{f.availabilityStatus}</Badge>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}

const quickActionStyle = { padding: "0.6rem 1rem", fontSize: "0.85rem", textDecoration: "none", color: "var(--ink)" };
