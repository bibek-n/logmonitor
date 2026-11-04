"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";

interface ConnectionInfo {
  Id: number;
  Name: string;
  Engine: string;
  HostName: string;
  Port: number;
  DatabaseName: string;
  Username: string;
  Enabled: boolean;
}

interface ScanHistoryRow {
  Id: number;
  Status: string;
  StartedAt: string;
  CompletedAt: string | null;
  TableCount: number | null;
  FindingCount: number | null;
  SecurityScore: number | null;
  RiskLevel: string | null;
  ErrorMessage: string | null;
  AnalysisMode: string | null;
}

interface Finding {
  Id: number;
  Category: string;
  Severity: string;
  Title: string;
  Detail: string | null;
  Evidence: string | null;
  AffectedObject: string | null;
  Recommendation: string | null;
  Source: string | null;
}

const MODE_LABELS: Record<string, string> = { non_ai: "Non-AI", ai: "AI", hybrid: "Hybrid" };

interface TableInfo {
  name: string;
  rowCountEstimate: number | null;
  columns: { name: string; dataType: string; nullable: boolean; isPrimaryKey: boolean; isForeignKey: boolean }[];
}

type Tone = "success" | "info" | "warning" | "danger" | "neutral";
function riskTone(risk: string | null): Tone {
  switch (risk) {
    case "Low":
      return "success";
    case "Medium":
      return "info";
    case "High":
      return "warning";
    case "Critical":
      return "danger";
    default:
      return "neutral";
  }
}
function severityTone(sev: string): Tone {
  switch (sev) {
    case "critical":
      return "danger";
    case "high":
      return "warning";
    case "medium":
      return "info";
    case "low":
      return "success";
    default:
      return "neutral";
  }
}

export function DatabaseAnalyzerDetailClient({ connectionId }: { connectionId: number }) {
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [history, setHistory] = useState<ScanHistoryRow[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<number | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingScan, setLoadingScan] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConnection = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/database-analyzer/connections/${connectionId}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to load connection.");
        return;
      }
      setConnection(data.connection);
      setHistory(data.history);
      const latest = data.history.find((h: ScanHistoryRow) => h.Status === "Completed");
      if (latest) setSelectedScanId(latest.Id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connection.");
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    loadConnection();
  }, [loadConnection]);

  useEffect(() => {
    if (!selectedScanId) return;
    (async () => {
      setLoadingScan(true);
      try {
        const res = await fetch(`/api/admin/database-analyzer/scans/${selectedScanId}`);
        const data = await res.json();
        if (res.ok && data.ok) {
          setTables(data.schema?.tables ?? []);
          setFindings(data.findings);
          setAiSummary(data.scan?.AiSummary ?? null);
          setAiError(data.scan?.AiError ?? null);
          setScanMode(data.scan?.AnalysisMode ?? null);
        }
      } finally {
        setLoadingScan(false);
      }
    })();
  }, [selectedScanId]);

  async function runScan() {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/database-analyzer/connections/${connectionId}/scan`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Scan failed.");
      } else {
        setSelectedScanId(data.scanId);
        await loadConnection();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  if (loading) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  return (
    <div>
      <Link href="/dashboard/database-analyzer" style={{ fontSize: "0.82rem", color: "var(--series-1)" }}>
        ← Back to all connections
      </Link>

      {error && (
        <div className="error" style={{ marginTop: "0.75rem" }}>
          {error}
        </div>
      )}

      {connection && (
        <div className="dash-panel" style={{ marginTop: "0.75rem" }}>
          <div className="flex items-center justify-between flex-wrap" style={{ gap: "0.5rem", marginBottom: "0.75rem" }}>
            <div>
              <h1 style={{ fontSize: "1.15rem", margin: 0 }}>{connection.Name}</h1>
              <div style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>
                {connection.Engine} — {connection.HostName}:{connection.Port}/{connection.DatabaseName}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={runScan} disabled={scanning} className="submit" style={{ width: "auto", marginTop: 0, padding: "0.4rem 1rem", fontSize: "0.82rem" }}>
                {scanning ? "Scanning..." : "Scan now"}
              </button>
              {selectedScanId && (
                <>
                  <a href={`/api/admin/database-analyzer/scans/${selectedScanId}/export?format=csv`} style={{ fontSize: "0.78rem", color: "var(--series-1)" }}>
                    Export CSV
                  </a>
                  <a href={`/api/admin/database-analyzer/scans/${selectedScanId}/export?format=json`} style={{ fontSize: "0.78rem", color: "var(--series-1)" }}>
                    Export JSON
                  </a>
                </>
              )}
            </div>
          </div>

          {loadingScan ? (
            <p style={{ color: "var(--ink-muted)" }}>Loading scan...</p>
          ) : selectedScanId ? (
            <>
              {scanMode && scanMode !== "non_ai" && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <Badge tone="info">{MODE_LABELS[scanMode] ?? scanMode} analysis</Badge>
                </div>
              )}
              {aiSummary && (
                <div className="dash-panel" style={{ marginBottom: "0.75rem", background: "var(--plane)" }}>
                  <strong style={{ fontSize: "0.85rem" }}>AI Summary</strong>
                  <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", marginBottom: 0 }}>{aiSummary}</p>
                </div>
              )}
              {aiError && (
                <div style={{ fontSize: "0.78rem", color: "var(--danger)", marginBottom: "0.75rem" }}>AI analysis issue: {aiError}</div>
              )}
              <h3 style={{ fontSize: "0.9rem" }}>Tables ({tables.length})</h3>
              {tables.length === 0 ? (
                <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No tables found.</p>
              ) : (
                <ul style={{ paddingLeft: "1.1rem", fontSize: "0.83rem", marginBottom: "1rem" }}>
                  {tables.map((t) => (
                    <li key={t.name} style={{ marginBottom: "0.3rem" }}>
                      <strong>{t.name}</strong> — {t.columns.length} column{t.columns.length === 1 ? "" : "s"}
                      {t.rowCountEstimate != null && `, ~${t.rowCountEstimate.toLocaleString()} rows`}
                    </li>
                  ))}
                </ul>
              )}

              <h3 style={{ fontSize: "0.9rem" }}>Findings ({findings.length})</h3>
              {findings.length === 0 ? (
                <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No issues found.</p>
              ) : (
                <ul style={{ paddingLeft: "1.1rem", fontSize: "0.83rem" }}>
                  {findings.map((f) => (
                    <li key={f.Id} style={{ marginBottom: "0.5rem" }}>
                      <Badge tone={severityTone(f.Severity)}>{f.Severity}</Badge>{" "}
                      <Badge tone="neutral">{f.Category}</Badge>{" "}
                      {f.Source === "ai" && <Badge tone="info">AI</Badge>} <strong>{f.Title}</strong>
                      {f.Detail && <div style={{ color: "var(--ink-muted)" }}>{f.Detail}</div>}
                      {f.AffectedObject && <div style={{ color: "var(--ink-muted)", fontSize: "0.75rem" }}>{f.AffectedObject}</div>}
                      {f.Recommendation && <div style={{ color: "var(--ink-muted)" }}>Fix: {f.Recommendation}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p style={{ color: "var(--ink-muted)" }}>No completed scan yet — click &quot;Scan now&quot; above.</p>
          )}

          <h3 style={{ fontSize: "0.9rem" }}>Scan History</h3>
          {history.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No scans yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "0.4rem" }}>Started</th>
                  <th style={{ padding: "0.4rem" }}>Status</th>
                  <th style={{ padding: "0.4rem" }}>Score</th>
                  <th style={{ padding: "0.4rem" }}>Risk</th>
                  <th style={{ padding: "0.4rem" }}>Mode</th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>{new Date(h.StartedAt).toLocaleString()}</td>
                    <td style={{ padding: "0.4rem" }}>{h.Status === "Failed" ? <span style={{ color: "var(--danger)" }} title={h.ErrorMessage ?? ""}>Failed</span> : h.Status}</td>
                    <td style={{ padding: "0.4rem" }}>{h.SecurityScore ?? "—"}</td>
                    <td style={{ padding: "0.4rem" }}>{h.RiskLevel ? <Badge tone={riskTone(h.RiskLevel)}>{h.RiskLevel}</Badge> : "—"}</td>
                    <td style={{ padding: "0.4rem" }}>{h.AnalysisMode ? MODE_LABELS[h.AnalysisMode] ?? h.AnalysisMode : "—"}</td>
                    <td style={{ padding: "0.4rem" }}>
                      {h.Status === "Completed" && (
                        <button
                          type="button"
                          onClick={() => setSelectedScanId(h.Id)}
                          style={{ background: "none", border: "none", color: "var(--series-1)", cursor: "pointer", padding: 0, textDecoration: "underline", fontSize: "0.78rem" }}
                        >
                          {selectedScanId === h.Id ? "Viewing" : "View"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
