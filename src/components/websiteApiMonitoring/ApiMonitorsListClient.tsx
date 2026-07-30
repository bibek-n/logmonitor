"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { useDisplaySettings } from "@/lib/useDisplaySettings";
import { formatDateTime } from "@/lib/dateFormat";

interface MonitorRow {
  id: number;
  name: string;
  environment: string | null;
  status: string;
  isActive: boolean;
  lastCheckedAt: string | null;
  nextCheckAt: string;
  config: { url: string; httpMethod: string; expectedStatusCode: number };
}

const STATUS_COLOR: Record<string, string> = {
  Up: "var(--success)",
  Down: "var(--danger)",
  Degraded: "var(--warning)",
  Paused: "var(--ink-muted)",
  Maintenance: "var(--warning)",
  Pending: "var(--ink-muted)",
  Unknown: "var(--ink-muted)",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", color: STATUS_COLOR[status] ?? "var(--ink)", fontWeight: 600 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[status] ?? "var(--ink-muted)", display: "inline-block" }} />
      {status}
    </span>
  );
}

function ApiMonitorsInner() {
  const toast = useToast();
  const displaySettings = useDisplaySettings();
  const [monitors, setMonitors] = useState<MonitorRow[] | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/monitoring/api");
    const data = await res.json();
    if (res.ok && data.ok) setMonitors(data.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function callAction(id: number, action: "pause" | "resume" | "duplicate", label: string) {
    const res = await fetch(`/api/admin/monitoring/api/${id}/${action}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? `Failed to ${label}.` });
      return;
    }
    toast.show({ type: "success", message: data.note ?? `${label} succeeded.` });
    await load();
  }

  async function remove(id: number, name: string) {
    const res = await fetch(`/api/admin/monitoring/api/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to delete monitor." });
      return;
    }
    toast.show({ type: "success", message: `${name} deleted.` });
    await load();
  }

  const filtered = monitors?.filter((m) => !query || m.name.toLowerCase().includes(query.toLowerCase()) || m.config.url.toLowerCase().includes(query.toLowerCase())) ?? [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem", gap: "0.75rem", flexWrap: "wrap" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or URL..."
          style={{ padding: "0.5rem 0.7rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.85rem", flex: "1 1 260px" }}
        />
        <Link href="/dashboard/monitoring/api/new">
          <Button>New API Monitor</Button>
        </Link>
      </div>

      {monitors === null ? (
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>No API monitors yet.</p>
      ) : (
        <div className="dash-panel">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>S.N.</th>
                  <th style={{ padding: "0.4rem" }}>Status</th>
                  <th style={{ padding: "0.4rem" }}>Name</th>
                  <th style={{ padding: "0.4rem" }}>Method</th>
                  <th style={{ padding: "0.4rem" }}>URL</th>
                  <th style={{ padding: "0.4rem" }}>Environment</th>
                  <th style={{ padding: "0.4rem" }}>Last Checked</th>
                  <th style={{ padding: "0.4rem" }}>Next Check</th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, index) => (
                  <tr key={m.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{index + 1}</td>
                    <td style={{ padding: "0.4rem" }}>
                      <StatusBadge status={m.status} />
                    </td>
                    <td style={{ padding: "0.4rem" }}>
                      <Link href={`/dashboard/monitoring/api/${m.id}`} style={{ color: "var(--series-1)" }}>
                        {m.name}
                      </Link>
                    </td>
                    <td style={{ padding: "0.4rem", fontFamily: "monospace" }}>{m.config.httpMethod}</td>
                    <td style={{ padding: "0.4rem", fontFamily: "monospace", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.config.url}</td>
                    <td style={{ padding: "0.4rem" }}>{m.environment ?? "-"}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{m.lastCheckedAt ? formatDateTime(new Date(m.lastCheckedAt), displaySettings) : "-"}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{formatDateTime(new Date(m.nextCheckAt), displaySettings)}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        <Link href={`/dashboard/monitoring/api/${m.id}/edit`}>
                          <Button size="sm" variant="secondary">
                            Edit
                          </Button>
                        </Link>
                        {m.status === "Paused" ? (
                          <Button size="sm" variant="secondary" onClick={() => callAction(m.id, "resume", "Resume")}>
                            Resume
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => callAction(m.id, "pause", "Pause")}>
                            Pause
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => callAction(m.id, "duplicate", "Duplicate")}>
                          Duplicate
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => remove(m.id, m.name)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function ApiMonitorsListClient() {
  return (
    <ToastProvider>
      <ApiMonitorsInner />
    </ToastProvider>
  );
}
