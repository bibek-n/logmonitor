"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";

interface HistoryRow {
  Id: number;
  ScanDate: string;
  Status: string;
  SecurityScore: number | null;
}

interface DiffFinding {
  category: string;
  severity: string;
  title: string;
}
interface DiffDependency {
  packageName: string;
  ecosystem: string;
  severity: string;
  cveIds: string | null;
}
interface DiffCode {
  category: string;
  severity: string;
  location: string | null;
}
interface CompareResponse {
  ok: boolean;
  error?: string;
  websiteName: string;
  older: { scanId: number; scanDate: string; securityScore: number; riskLevel: string };
  newer: { scanId: number; scanDate: string; securityScore: number; riskLevel: string };
  scoreDelta: number;
  findings: { added: DiffFinding[]; fixed: DiffFinding[]; persisting: DiffFinding[] };
  dependencyFindings: { added: DiffDependency[]; fixed: DiffDependency[]; persisting: DiffDependency[] };
  codeFindings: { added: DiffCode[]; fixed: DiffCode[]; persisting: DiffCode[] };
}

type Tone = "success" | "info" | "warning" | "danger" | "neutral";
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

export function CompareScansModal({ history, onClose }: { history: HistoryRow[]; onClose: () => void }) {
  const completed = history.filter((h) => h.Status === "Completed");
  const [olderId, setOlderId] = useState<string>(completed.length > 1 ? String(completed[1].Id) : "");
  const [newerId, setNewerId] = useState<string>(completed.length > 0 ? String(completed[0].Id) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResponse | null>(null);

  useEffect(() => {
    if (!olderId || !newerId) return;
    if (olderId === newerId) {
      setResult(null);
      setError("Pick two different scans to compare.");
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/website-security/compare?a=${olderId}&b=${newerId}`);
        const data = await res.json();
        if (cancelled) return;
        if (!data.ok) {
          setError(data.error ?? "Failed to compare scans.");
          setResult(null);
        } else {
          setResult(data);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to compare scans.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [olderId, newerId]);

  const scanOptions = completed.map((h) => ({ label: `${new Date(h.ScanDate).toLocaleDateString()} — score ${h.SecurityScore ?? "—"}`, value: String(h.Id) }));

  return (
    <Modal open onClose={onClose} title="Compare Scans">
      <div className="flex flex-col gap-4">
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.3rem", display: "block" }}>Earlier scan</label>
            <Select value={olderId} onChange={setOlderId} options={scanOptions} />
          </div>
          <div>
            <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.3rem", display: "block" }}>Later scan</label>
            <Select value={newerId} onChange={setNewerId} options={scanOptions} />
          </div>
        </div>

        {loading && <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Comparing...</p>}
        {error && <div className="error">{error}</div>}

        {result && !loading && (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge tone="neutral">{result.older.scanDate}: {result.older.securityScore}/100</Badge>
              <span style={{ color: "var(--ink-muted)" }}>→</span>
              <Badge tone="neutral">{result.newer.scanDate}: {result.newer.securityScore}/100</Badge>
              <Badge tone={result.scoreDelta > 0 ? "success" : result.scoreDelta < 0 ? "danger" : "neutral"}>
                {result.scoreDelta > 0 ? "+" : ""}{result.scoreDelta} points
              </Badge>
            </div>

            <DiffSection
              title={`New findings (${result.findings.added.length})`}
              tone="danger"
              items={result.findings.added.map((f) => ({ severity: f.severity, label: f.title }))}
              empty="No new findings since the earlier scan."
            />
            <DiffSection
              title={`Fixed findings (${result.findings.fixed.length})`}
              tone="success"
              items={result.findings.fixed.map((f) => ({ severity: f.severity, label: f.title }))}
              empty="Nothing was resolved between these two scans."
            />
            <DiffSection
              title={`Still present (${result.findings.persisting.length})`}
              tone="neutral"
              items={result.findings.persisting.map((f) => ({ severity: f.severity, label: f.title }))}
              empty="No carried-over findings."
              collapsedByDefault
            />

            {(result.dependencyFindings.added.length > 0 || result.dependencyFindings.fixed.length > 0) && (
              <>
                <DiffSection
                  title={`New package risks (${result.dependencyFindings.added.length})`}
                  tone="danger"
                  items={result.dependencyFindings.added.map((f) => ({ severity: f.severity, label: `${f.packageName}@${f.ecosystem}${f.cveIds ? ` — ${f.cveIds}` : ""}` }))}
                  empty=""
                />
                <DiffSection
                  title={`Fixed package risks (${result.dependencyFindings.fixed.length})`}
                  tone="success"
                  items={result.dependencyFindings.fixed.map((f) => ({ severity: f.severity, label: `${f.packageName}@${f.ecosystem}` }))}
                  empty=""
                />
              </>
            )}

            {(result.codeFindings.added.length > 0 || result.codeFindings.fixed.length > 0) && (
              <>
                <DiffSection
                  title={`New code risks (${result.codeFindings.added.length})`}
                  tone="danger"
                  items={result.codeFindings.added.map((f) => ({ severity: f.severity, label: `${f.category}${f.location ? ` — ${f.location}` : ""}` }))}
                  empty=""
                />
                <DiffSection
                  title={`Fixed code risks (${result.codeFindings.fixed.length})`}
                  tone="success"
                  items={result.codeFindings.fixed.map((f) => ({ severity: f.severity, label: f.category }))}
                  empty=""
                />
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function DiffSection({
  title,
  tone,
  items,
  empty,
  collapsedByDefault,
}: {
  title: string;
  tone: Tone;
  items: { severity: string; label: string }[];
  empty: string;
  collapsedByDefault?: boolean;
}) {
  const [open, setOpen] = useState(!collapsedByDefault);
  if (items.length === 0 && !empty) return null;
  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.6rem" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: "0.4rem", font: "inherit" }}
      >
        <Badge tone={tone}>{title}</Badge>
        <span style={{ color: "var(--ink-muted)", fontSize: "0.75rem" }}>{open ? "hide" : "show"}</span>
      </button>
      {open && (
        items.length === 0 ? (
          <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", margin: "0.4rem 0 0" }}>{empty}</p>
        ) : (
          <ul style={{ paddingLeft: "1.1rem", fontSize: "0.82rem", margin: "0.4rem 0 0" }}>
            {items.map((it, i) => (
              <li key={i} style={{ marginBottom: "0.3rem" }}>
                <Badge tone={severityTone(it.severity)}>{it.severity}</Badge> {it.label}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
