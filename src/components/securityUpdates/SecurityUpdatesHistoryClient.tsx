"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { parseJsonResponse } from "@/lib/apiFetch";
import { formatUtcTimestamp } from "@/lib/formatUtcTimestamp";
import { inputStyle, osLabel, eventTone, EVENT_LABELS, th, td } from "./shared";

interface HistoryRow {
  id: number;
  deviceId: string | null;
  hostname: string | null;
  os: string | null;
  eventType: string;
  title: string | null;
  category: string | null;
  detail: string | null;
  actor: string | null;
  incidentNumber: string | null;
  createdAt: string;
}

export function SecurityUpdatesHistoryClient({ canExport }: { canExport: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [os, setOs] = useState("");
  const [eventType, setEventType] = useState("");
  const [actor, setActor] = useState("");
  const [incident, setIncident] = useState("");

  function filterParams(): URLSearchParams {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (q.trim()) params.set("q", q.trim());
    if (os) params.set("os", os);
    if (eventType) params.set("eventType", eventType);
    if (actor.trim()) params.set("actor", actor.trim());
    if (incident.trim()) params.set("incident", incident.trim());
    return params;
  }

  async function load(nextPage = page) {
    setLoading(true);
    try {
      const params = filterParams();
      params.set("page", String(nextPage));
      params.set("pageSize", String(pageSize));
      const res = await fetch(`/api/admin/security-updates/history?${params.toString()}`);
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string; data?: HistoryRow[]; total?: number };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load history");
      setRows(json.data ?? []);
      setTotal(json.total ?? 0);
      setPage(nextPage);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to load history." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
            From <input style={{ ...inputStyle, marginLeft: 4 }} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
            To <input style={{ ...inputStyle, marginLeft: 4 }} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <input style={inputStyle} placeholder="Device or update" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)} />
          <select style={inputStyle} value={os} onChange={(e) => setOs(e.target.value)}>
            <option value="">Any OS</option>
            <option value="windows">Windows</option>
            <option value="linux">Linux</option>
            <option value="darwin">macOS</option>
          </select>
          <select style={inputStyle} value={eventType} onChange={(e) => setEventType(e.target.value)}>
            <option value="">Any event</option>
            {Object.entries(EVENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input style={inputStyle} placeholder="Staff / actor name" value={actor} onChange={(e) => setActor(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)} />
          <input style={inputStyle} placeholder="Incident ID (INC-2026-000001)" value={incident} onChange={(e) => setIncident(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)} />
          <Button onClick={() => load(1)} disabled={loading}>
            {loading ? "Loading..." : "Apply filters"}
          </Button>
          {canExport && (
            <a href={`/api/admin/security-updates/history/export?${filterParams().toString()}`} style={{ textDecoration: "none" }}>
              <Button variant="secondary" type="button">
                Export CSV
              </Button>
            </a>
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        {loading && rows.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>Loading...</p>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>No history yet. Events appear here as scans run and updates are found, fail or clear.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  {["Time", "Device", "OS", "Event", "Update", "Detail", "By", "Incident"].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>
                    <td style={{ ...td, whiteSpace: "nowrap", color: "var(--ink-muted)" }}>{formatUtcTimestamp(r.createdAt)}</td>
                    <td style={td}>{r.hostname ?? "-"}</td>
                    <td style={td}>{r.os ? osLabel(r.os) : "-"}</td>
                    <td style={td}>
                      <Badge tone={eventTone(r.eventType)}>{EVENT_LABELS[r.eventType] ?? r.eventType}</Badge>
                    </td>
                    <td style={td}>{r.title ?? "-"}</td>
                    <td style={{ ...td, color: "var(--ink-muted)" }}>{r.detail ?? ""}</td>
                    <td style={td}>{r.actor ?? "-"}</td>
                    <td style={td}>{r.incidentNumber ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center gap-3" style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
          <span>
            Page {page} of {pages} ({total} events)
          </span>
          <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>
            Previous
          </Button>
          <Button size="sm" variant="secondary" disabled={page >= pages || loading} onClick={() => load(page + 1)}>
            Next
          </Button>
        </div>
      </Card>
    </div>
  );
}
