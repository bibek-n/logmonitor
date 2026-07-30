"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface Connection {
  id: number;
  name: string;
  hostname: string | null;
  ipAddress: string | null;
  port: number;
  protocol: string;
  environment: string;
  availabilityStatus: string;
  isFavorite: boolean;
  tags: string[];
}

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  Online: "success",
  Offline: "danger",
  Degraded: "warning",
  Unknown: "neutral",
};

const inputStyle = {
  padding: "0.45rem 0.6rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

function ConnectionsInner() {
  const toast = useToast();
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async (searchTerm?: string) => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    const res = await fetch(`/api/admin/remote-access/connections?${params.toString()}`);
    const data = await res.json();
    if (res.ok && data.ok) setConnections(data.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function testConnection(id: number) {
    const res = await fetch(`/api/admin/remote-access/connections/${id}/test`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Test failed." });
      return;
    }
    toast.show({ type: data.data.status === "Online" ? "success" : "error", message: `Status: ${data.data.status}${data.data.latencyMs ? ` (${data.data.latencyMs}ms)` : ""}` });
    await load(search);
  }

  async function openTerminal(id: number) {
    const res = await fetch("/api/admin/remote-access/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId: id }) });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to open session." });
      return;
    }
    router.push(`/dashboard/remote-access/terminal/${data.data.sessionId}`);
  }

  async function cloneConnection(id: number) {
    const res = await fetch(`/api/admin/remote-access/connections/${id}/clone`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Clone failed." });
      return;
    }
    toast.show({ type: "success", message: "Connection cloned." });
    await load(search);
  }

  async function toggleFavorite(c: Connection) {
    await fetch(`/api/admin/remote-access/connections/${c.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isFavorite: !c.isFavorite }) });
    await load(search);
  }

  async function removeConnection(id: number, name: string) {
    if (!confirm(`Delete connection "${name}"?`)) return;
    const res = await fetch(`/api/admin/remote-access/connections/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Delete failed." });
      return;
    }
    toast.show({ type: "success", message: `${name} deleted.` });
    await load(search);
  }

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "space-between" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(search)}
            placeholder="Search by name, host, IP, or tag..."
            style={{ ...inputStyle, minWidth: 280 }}
          />
          <Link href="/dashboard/remote-access/connections/new">
            <Button>+ New Connection</Button>
          </Link>
        </div>
      </Card>

      <div className="dash-panel">
        {connections === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : connections.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No connections yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}></th>
                  <th style={{ padding: "0.4rem" }}>Name</th>
                  <th style={{ padding: "0.4rem" }}>Host</th>
                  <th style={{ padding: "0.4rem" }}>Protocol</th>
                  <th style={{ padding: "0.4rem" }}>Environment</th>
                  <th style={{ padding: "0.4rem" }}>Status</th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {connections.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem", cursor: "pointer" }} onClick={() => toggleFavorite(c)}>
                      {c.isFavorite ? "★" : "☆"}
                    </td>
                    <td style={{ padding: "0.4rem" }}>
                      <Link href={`/dashboard/remote-access/connections/${c.id}/edit`}>{c.name}</Link>
                    </td>
                    <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>
                      {c.hostname || c.ipAddress}:{c.port}
                    </td>
                    <td style={{ padding: "0.4rem" }}>{c.protocol}</td>
                    <td style={{ padding: "0.4rem" }}>{c.environment}</td>
                    <td style={{ padding: "0.4rem" }}>
                      <Badge tone={STATUS_TONE[c.availabilityStatus] ?? "neutral"}>{c.availabilityStatus}</Badge>
                    </td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        {c.protocol === "SSH" && (
                          <>
                            <Button size="sm" onClick={() => openTerminal(c.id)}>
                              Connect
                            </Button>
                            <Link href={`/dashboard/remote-access/connections/${c.id}/containers`}>
                              <Button size="sm" variant="secondary">
                                Containers
                              </Button>
                            </Link>
                          </>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => testConnection(c.id)}>
                          Test
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => cloneConnection(c.id)}>
                          Clone
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => removeConnection(c.id, c.name)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function ConnectionsClient() {
  return (
    <ToastProvider>
      <ConnectionsInner />
    </ToastProvider>
  );
}
