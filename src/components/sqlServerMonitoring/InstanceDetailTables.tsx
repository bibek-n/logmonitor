"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { CopyButton } from "@/components/ui/CopyButton";

interface DatabaseRow {
  DatabaseName: string;
  StateDesc: string;
  RecoveryModel: string | null;
  DataSizeMB: number | null;
  LogSizeMB: number | null;
  LogUsedPercent: number | null;
  LastBackupAt: string | null;
  LastBackupType: string | null;
}
interface DeadlockRow {
  Id: number;
  DetectedAt: string;
  Summary: string;
  DeadlockGraphXml?: string | null;
}
interface BlockingRow {
  Id: number;
  DetectedAt: string;
  BlockedSessionId: number | string;
  BlockingSessionId: number | string;
  WaitTimeMs: number | null;
  WaitType: string | null;
  DatabaseName: string | null;
  BlockedQueryText: string | null;
}
interface QueryRow {
  Id: number;
  DetectedAt: string;
  DatabaseName: string | null;
  QueryText: string | null;
  ExecutionCount: number;
  AvgDurationMs?: number;
  AvgCpuTimeMs?: number | null;
  MaxUsedGrantKB?: number | null;
}
interface SessionRow {
  SessionId: string;
  LoginName: string | null;
  HostName: string | null;
  ProgramName: string | null;
  DatabaseName: string | null;
  StatusText: string | null;
  CpuTimeMs: number | null;
  MemoryUsageKB: number | null;
  LastRequestStartTime: string | null;
}

type Selected =
  | { kind: "database"; row: DatabaseRow }
  | { kind: "deadlock"; row: DeadlockRow }
  | { kind: "blocking"; row: BlockingRow }
  | { kind: "duration" | "cpu" | "memory"; row: QueryRow }
  | { kind: "session"; row: SessionRow };

function usageTone(pct: number | null): "success" | "warning" | "danger" | "neutral" {
  if (pct === null) return "neutral";
  if (pct >= 90) return "danger";
  if (pct >= 75) return "warning";
  return "success";
}

const rowStyle: React.CSSProperties = { cursor: "pointer" };
const cellStyle: React.CSSProperties = { padding: "0.3rem" };
const truncCellStyle: React.CSSProperties = { padding: "0.3rem", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between" style={{ padding: "0.3rem 0", borderBottom: "1px solid var(--border)", gap: "1rem" }}>
      <dt style={{ color: "var(--ink-muted)", flexShrink: 0 }}>{label}</dt>
      <dd style={{ margin: 0, textAlign: "right" }}>{value}</dd>
    </div>
  );
}

function FullTextBlock({ text }: { text: string }) {
  return (
    <div style={{ marginTop: "0.5rem" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.35rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)", textTransform: "uppercase" }}>Full Text</span>
        <CopyButton value={text} label="Copy" />
      </div>
      <pre
        style={{
          margin: 0,
          padding: "0.75rem",
          background: "var(--plane)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          fontSize: "0.78rem",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: 360,
          overflowY: "auto",
        }}
      >
        {text}
      </pre>
    </div>
  );
}

function modalTitle(sel: Selected): string {
  switch (sel.kind) {
    case "database":
      return `Database: ${sel.row.DatabaseName}`;
    case "deadlock":
      return "Deadlock Detail";
    case "blocking":
      return "Blocking Detail";
    case "duration":
    case "cpu":
    case "memory":
      return "Query Detail";
    case "session":
      return "Session Detail";
  }
}

function ModalBody({ sel }: { sel: Selected }) {
  if (sel.kind === "database") {
    const d = sel.row;
    return (
      <dl style={{ margin: 0 }}>
        <DetailRow label="Database" value={d.DatabaseName} />
        <DetailRow label="State" value={<Badge tone={d.StateDesc === "ONLINE" ? "success" : "danger"}>{d.StateDesc}</Badge>} />
        <DetailRow label="Recovery Model" value={d.RecoveryModel ?? "—"} />
        <DetailRow label="Data Size" value={d.DataSizeMB != null ? `${(d.DataSizeMB / 1024).toFixed(2)} GB` : "—"} />
        <DetailRow label="Log Size" value={d.LogSizeMB != null ? `${d.LogSizeMB.toFixed(0)} MB` : "—"} />
        <DetailRow label="Log Used" value={d.LogUsedPercent != null ? <Badge tone={usageTone(d.LogUsedPercent)}>{d.LogUsedPercent.toFixed(1)}%</Badge> : "—"} />
        <DetailRow label="Last Backup" value={d.LastBackupAt ? `${d.LastBackupAt} (${d.LastBackupType ?? "?"})` : <span style={{ color: "var(--danger)" }}>Never</span>} />
      </dl>
    );
  }

  if (sel.kind === "deadlock") {
    const d = sel.row;
    return (
      <div>
        <dl style={{ margin: 0 }}>
          <DetailRow label="Detected At" value={d.DetectedAt} />
          <DetailRow label="Summary" value={d.Summary} />
        </dl>
        {d.DeadlockGraphXml ? <FullTextBlock text={d.DeadlockGraphXml} /> : <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No deadlock graph XML captured for this event.</p>}
      </div>
    );
  }

  if (sel.kind === "blocking") {
    const b = sel.row;
    return (
      <div>
        <dl style={{ margin: 0 }}>
          <DetailRow label="Detected At" value={b.DetectedAt} />
          <DetailRow label="Blocked Session" value={b.BlockedSessionId} />
          <DetailRow label="Blocking Session" value={b.BlockingSessionId} />
          <DetailRow label="Wait Time" value={b.WaitTimeMs != null ? `${b.WaitTimeMs} ms` : "—"} />
          <DetailRow label="Wait Type" value={b.WaitType ?? "—"} />
          <DetailRow label="Database" value={b.DatabaseName ?? "—"} />
        </dl>
        {b.BlockedQueryText ? <FullTextBlock text={b.BlockedQueryText} /> : <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No query text captured.</p>}
      </div>
    );
  }

  if (sel.kind === "session") {
    const s = sel.row;
    return (
      <dl style={{ margin: 0 }}>
        <DetailRow label="Session Id" value={s.SessionId} />
        <DetailRow label="Login" value={s.LoginName ?? "—"} />
        <DetailRow label="Host" value={s.HostName ?? "—"} />
        <DetailRow label="Program" value={s.ProgramName ?? "—"} />
        <DetailRow label="Database" value={s.DatabaseName ?? "—"} />
        <DetailRow label="Status" value={s.StatusText ?? "—"} />
        <DetailRow label="CPU Time" value={s.CpuTimeMs != null ? `${s.CpuTimeMs.toLocaleString()} ms` : "—"} />
        <DetailRow label="Memory" value={s.MemoryUsageKB != null ? `${(s.MemoryUsageKB / 1024).toFixed(2)} MB` : "—"} />
        <DetailRow label="Last Request Start" value={s.LastRequestStartTime ?? "—"} />
      </dl>
    );
  }

  // duration | cpu | memory query kinds
  const q = sel.row;
  return (
    <div>
      <dl style={{ margin: 0 }}>
        <DetailRow label="Detected At" value={q.DetectedAt} />
        <DetailRow label="Database" value={q.DatabaseName ?? "—"} />
        <DetailRow label="Executions" value={q.ExecutionCount.toLocaleString()} />
        {q.AvgDurationMs != null && <DetailRow label="Avg Duration" value={`${q.AvgDurationMs.toFixed(1)} ms`} />}
        {q.AvgCpuTimeMs != null && <DetailRow label="Avg CPU Time" value={`${q.AvgCpuTimeMs.toFixed(1)} ms`} />}
        {q.MaxUsedGrantKB != null && <DetailRow label="Max Memory Grant" value={`${(q.MaxUsedGrantKB / 1024).toFixed(1)} MB`} />}
      </dl>
      {q.QueryText ? <FullTextBlock text={q.QueryText} /> : <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No query text captured.</p>}
    </div>
  );
}

export function InstanceDetailTables({
  databases,
  deadlocks,
  blocking,
  durationQueries,
  cpuQueries,
  memoryQueries,
  sessions,
  engine,
}: {
  databases: DatabaseRow[];
  deadlocks: DeadlockRow[];
  blocking: BlockingRow[];
  durationQueries: QueryRow[];
  cpuQueries: QueryRow[];
  memoryQueries: QueryRow[];
  sessions: SessionRow[];
  engine: string;
}) {
  const [selected, setSelected] = useState<Selected | null>(null);

  return (
    <>
      <Card className="flex flex-col gap-2">
        <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Databases</h3>
        {databases.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No database data synced yet.</p>
        ) : (
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={cellStyle}>Database</th>
                  <th style={cellStyle}>State</th>
                  <th style={cellStyle}>Data / Log</th>
                  <th style={cellStyle}>Log Used</th>
                  <th style={cellStyle}>Last Backup</th>
                </tr>
              </thead>
              <tbody>
                {databases.map((d) => (
                  <tr key={d.DatabaseName} style={rowStyle} onClick={() => setSelected({ kind: "database", row: d })}>
                    <td style={cellStyle}>{d.DatabaseName}</td>
                    <td style={cellStyle}>
                      <Badge tone={d.StateDesc === "ONLINE" ? "success" : "danger"}>{d.StateDesc}</Badge>
                    </td>
                    <td style={cellStyle}>
                      {d.DataSizeMB != null ? `${(d.DataSizeMB / 1024).toFixed(2)} GB` : "—"} / {d.LogSizeMB != null ? `${d.LogSizeMB.toFixed(0)} MB` : "—"}
                    </td>
                    <td style={cellStyle}>{d.LogUsedPercent != null ? <Badge tone={usageTone(d.LogUsedPercent)}>{d.LogUsedPercent.toFixed(0)}%</Badge> : "—"}</td>
                    <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                      {d.LastBackupAt ?? <span style={{ color: "var(--danger)" }}>Never</span>}
                      {d.LastBackupType ? ` (${d.LastBackupType})` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-2">
        <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Recent Deadlocks</h3>
        {deadlocks.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No deadlocks recorded.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={cellStyle}>Time</th>
                <th style={cellStyle}>Summary</th>
              </tr>
            </thead>
            <tbody>
              {deadlocks.map((d) => (
                <tr key={d.Id} style={rowStyle} onClick={() => setSelected({ kind: "deadlock", row: d })}>
                  <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>{d.DetectedAt}</td>
                  <td style={cellStyle}>{d.Summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="flex flex-col gap-2">
        <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Blocking Queries</h3>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.74rem", margin: 0 }}>
          Point-in-time snapshots taken each monitoring pass - blocking shorter than the collection interval may not appear here.
        </p>
        {blocking.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No blocking detected in recent passes.</p>
        ) : (
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={cellStyle}>Time</th>
                  <th style={cellStyle}>Blocked → Blocking</th>
                  <th style={cellStyle}>Wait</th>
                  <th style={cellStyle}>Query</th>
                </tr>
              </thead>
              <tbody>
                {blocking.map((b) => (
                  <tr key={b.Id} style={rowStyle} onClick={() => setSelected({ kind: "blocking", row: b })}>
                    <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>{b.DetectedAt}</td>
                    <td style={cellStyle}>
                      {b.BlockedSessionId} → {b.BlockingSessionId}
                    </td>
                    <td style={cellStyle}>
                      {b.WaitTimeMs != null ? `${b.WaitTimeMs}ms` : "—"} {b.WaitType ?? ""}
                    </td>
                    <td style={truncCellStyle}>{b.BlockedQueryText ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-2">
        <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Slow Queries (Top 10 by Duration)</h3>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.74rem", margin: 0 }}>
          Top queries by average duration since the plan cache was last cleared or the instance last restarted. Click a row for the full query.
        </p>
        {durationQueries.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No query stats available yet.</p>
        ) : (
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={cellStyle}>Avg Duration</th>
                  <th style={cellStyle}>Executions</th>
                  <th style={cellStyle}>Database</th>
                  <th style={cellStyle}>Query</th>
                </tr>
              </thead>
              <tbody>
                {durationQueries.map((q) => (
                  <tr key={q.Id} style={rowStyle} onClick={() => setSelected({ kind: "duration", row: q })}>
                    <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>{q.AvgDurationMs!.toFixed(1)} ms</td>
                    <td style={cellStyle}>{q.ExecutionCount.toLocaleString()}</td>
                    <td style={cellStyle}>{q.DatabaseName ?? "—"}</td>
                    <td style={truncCellStyle}>{q.QueryText ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-2">
        <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Top 10 Queries by CPU Time</h3>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.74rem", margin: 0 }}>
          {engine === "mssql"
            ? "Ranked by average worker (CPU) time per execution, cumulative since the plan cache was last cleared. Click a row for the full query."
            : "Not available for this engine - MySQL/PostgreSQL don't expose an isolated per-query CPU time in their standard instrumentation."}
        </p>
        {cpuQueries.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No CPU query stats available.</p>
        ) : (
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={cellStyle}>Avg CPU Time</th>
                  <th style={cellStyle}>Executions</th>
                  <th style={cellStyle}>Database</th>
                  <th style={cellStyle}>Query</th>
                </tr>
              </thead>
              <tbody>
                {cpuQueries.map((q) => (
                  <tr key={q.Id} style={rowStyle} onClick={() => setSelected({ kind: "cpu", row: q })}>
                    <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>{q.AvgCpuTimeMs != null ? `${q.AvgCpuTimeMs.toFixed(1)} ms` : "—"}</td>
                    <td style={cellStyle}>{q.ExecutionCount.toLocaleString()}</td>
                    <td style={cellStyle}>{q.DatabaseName ?? "—"}</td>
                    <td style={truncCellStyle}>{q.QueryText ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-2">
        <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Top 10 Queries by Memory Grant</h3>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.74rem", margin: 0 }}>
          {engine === "mssql"
            ? "Ranked by max memory grant per execution, cumulative since the plan cache was last cleared. Click a row for the full query."
            : "Not available for this engine - MySQL/PostgreSQL don't expose a per-query memory grant in their standard instrumentation."}
        </p>
        {memoryQueries.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No memory query stats available.</p>
        ) : (
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={cellStyle}>Max Memory Grant</th>
                  <th style={cellStyle}>Executions</th>
                  <th style={cellStyle}>Database</th>
                  <th style={cellStyle}>Query</th>
                </tr>
              </thead>
              <tbody>
                {memoryQueries.map((q) => (
                  <tr key={q.Id} style={rowStyle} onClick={() => setSelected({ kind: "memory", row: q })}>
                    <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>{q.MaxUsedGrantKB != null ? `${(q.MaxUsedGrantKB / 1024).toFixed(1)} MB` : "—"}</td>
                    <td style={cellStyle}>{q.ExecutionCount.toLocaleString()}</td>
                    <td style={cellStyle}>{q.DatabaseName ?? "—"}</td>
                    <td style={truncCellStyle}>{q.QueryText ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-2">
        <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Active Sessions</h3>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.74rem", margin: 0 }}>
          Who is connected right now, ranked by CPU time - capped to the busiest 50 sessions per pass. Click a row for full session detail.
        </p>
        {sessions.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No active sessions recorded.</p>
        ) : (
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={cellStyle}>Login</th>
                  <th style={cellStyle}>Host</th>
                  <th style={cellStyle}>Database</th>
                  <th style={cellStyle}>Status</th>
                  <th style={cellStyle}>CPU</th>
                  <th style={cellStyle}>Memory</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={`${s.SessionId}-${i}`} style={rowStyle} onClick={() => setSelected({ kind: "session", row: s })}>
                    <td style={cellStyle}>{s.LoginName ?? "—"}</td>
                    <td style={cellStyle}>{s.HostName ?? "—"}</td>
                    <td style={cellStyle}>{s.DatabaseName ?? "—"}</td>
                    <td style={cellStyle}>{s.StatusText ?? "—"}</td>
                    <td style={cellStyle}>{s.CpuTimeMs != null ? `${s.CpuTimeMs.toLocaleString()} ms` : "—"}</td>
                    <td style={cellStyle}>{s.MemoryUsageKB != null ? `${(s.MemoryUsageKB / 1024).toFixed(1)} MB` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={selected !== null} onClose={() => setSelected(null)} title={selected ? modalTitle(selected) : undefined} size="lg">
        {selected && <ModalBody sel={selected} />}
      </Modal>
    </>
  );
}
