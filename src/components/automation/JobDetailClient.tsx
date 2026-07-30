"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card } from "@/components/ui/Card";

interface JobTarget {
  id: number;
  deviceId: string;
  deviceName: string | null;
  hostname: string;
  os: string;
  status: string;
  exitCode: number | null;
  stdout: string | null;
  stderr: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface JobDetail {
  id: number;
  scriptNameSnapshot: string;
  triggerType: string;
  createdAt: string;
  targets: JobTarget[];
}

const STATUS_COLOR: Record<string, string> = {
  Pending: "var(--ink-muted)",
  Running: "var(--warning, #b8860b)",
  Success: "var(--success)",
  Failed: "var(--danger)",
  TimedOut: "var(--danger)",
  Error: "var(--danger)",
};

// Polls every 3s while any target is still Pending/Running - same plain re-fetch pattern this
// app uses everywhere else for on-demand agent work (no websocket/push channel exists).
export function JobDetailClient({ jobId }: { jobId: number }) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/automation/jobs/${jobId}`);
    const data = await res.json();
    if (res.ok && data.ok) setJob(data.data);
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const stillPending = job?.targets.some((t) => t.status === "Pending" || t.status === "Running");
    if (stillPending && !timerRef.current) {
      timerRef.current = setInterval(load, 3000);
    } else if (!stillPending && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [job, load]);

  if (!job) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <strong>{job.scriptNameSnapshot}</strong>
            <span style={{ color: "var(--ink-muted)", marginLeft: "0.6rem", fontSize: "0.82rem" }}>
              {job.triggerType} - queued {new Date(job.createdAt).toLocaleString()}
            </span>
          </div>
          <span style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>{job.targets.length} target(s)</span>
        </div>
      </Card>

      {job.targets.map((t) => (
        <Card key={t.id} style={{ marginBottom: "0.8rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
            <div>
              <strong>{t.deviceName || t.hostname}</strong>
              <span style={{ color: "var(--ink-muted)", marginLeft: "0.5rem", fontSize: "0.78rem" }}>
                ({t.os === "windows" ? "Windows" : t.os === "linux" ? "Linux" : t.os})
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              {t.exitCode !== null && <span style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>exit code {t.exitCode}</span>}
              <span style={{ color: STATUS_COLOR[t.status] ?? "var(--ink)", fontWeight: 600 }}>{t.status}</span>
            </div>
          </div>

          {t.errorMessage && <p style={{ color: "var(--danger)", fontSize: "0.82rem" }}>{t.errorMessage}</p>}

          {(t.stdout || t.stderr) && (
            <div style={{ display: "grid", gridTemplateColumns: t.stderr ? "1fr 1fr" : "1fr", gap: "0.6rem" }}>
              {t.stdout && (
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--ink-muted)", marginBottom: "0.2rem" }}>stdout</label>
                  <pre style={preStyle}>{t.stdout}</pre>
                </div>
              )}
              {t.stderr && (
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--ink-muted)", marginBottom: "0.2rem" }}>stderr</label>
                  <pre style={{ ...preStyle, color: "var(--danger)" }}>{t.stderr}</pre>
                </div>
              )}
            </div>
          )}

          {(t.status === "Pending" || t.status === "Running") && (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>Waiting for the agent's next check-in...</p>
          )}
        </Card>
      ))}
    </div>
  );
}

const preStyle = {
  background: "var(--surface-2, var(--surface))",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "0.6rem",
  fontSize: "0.78rem",
  maxHeight: 300,
  overflow: "auto",
  whiteSpace: "pre-wrap" as const,
  wordBreak: "break-word" as const,
  margin: 0,
};
