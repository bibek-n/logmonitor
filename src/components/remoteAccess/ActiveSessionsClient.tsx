"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface Session {
  Id: number;
  ConnectionName: string | null;
  TargetHost: string;
  Protocol: string;
  StartedByUsername: string | null;
  StartedAt: string;
  Status: string;
  RecordingStatus: string;
}

function SessionsInner() {
  const toast = useToast();
  const [sessions, setSessions] = useState<Session[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/remote-access/sessions");
    const data = await res.json();
    if (res.ok && data.ok) setSessions(data.data);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  async function terminate(session: Session) {
    const isOwn = true; // server-side determines actual ownership; this is just the confirm-copy heuristic
    if (!confirm(`Terminate session on ${session.TargetHost}${isOwn ? "" : " (started by another user)"}?`)) return;
    const res = await fetch(`/api/admin/remote-access/sessions/${session.Id}/terminate`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to terminate session." });
      return;
    }
    toast.show({ type: "success", message: "Session terminated." });
    await load();
  }

  if (!sessions) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  return (
    <div className="dash-panel">
      {sessions.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>No sessions yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                <th style={{ padding: "0.4rem" }}>Connection</th>
                <th style={{ padding: "0.4rem" }}>Host</th>
                <th style={{ padding: "0.4rem" }}>Protocol</th>
                <th style={{ padding: "0.4rem" }}>User</th>
                <th style={{ padding: "0.4rem" }}>Started</th>
                <th style={{ padding: "0.4rem" }}>Status</th>
                <th style={{ padding: "0.4rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>{s.ConnectionName ?? "(ad-hoc)"}</td>
                  <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{s.TargetHost}</td>
                  <td style={{ padding: "0.4rem" }}>{s.Protocol}</td>
                  <td style={{ padding: "0.4rem" }}>{s.StartedByUsername}</td>
                  <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{new Date(s.StartedAt).toLocaleString()}</td>
                  <td style={{ padding: "0.4rem" }}>
                    <Badge tone={s.Status === "Active" ? "info" : s.Status === "Failed" ? "danger" : "neutral"}>{s.Status}</Badge>
                  </td>
                  <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: "0.3rem" }}>
                      {s.Status === "Active" && (
                        <>
                          <Link href={`/dashboard/remote-access/terminal/${s.Id}`}>
                            <Button size="sm">Open</Button>
                          </Link>
                          <Button size="sm" variant="danger" onClick={() => terminate(s)}>
                            Terminate
                          </Button>
                        </>
                      )}
                      {s.RecordingStatus !== "NotRecorded" && (
                        <Link href={`/dashboard/remote-access/sessions/${s.Id}/transcript`}>
                          <Button size="sm" variant="secondary">
                            Transcript
                          </Button>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ActiveSessionsClient() {
  return (
    <ToastProvider>
      <SessionsInner />
    </ToastProvider>
  );
}
