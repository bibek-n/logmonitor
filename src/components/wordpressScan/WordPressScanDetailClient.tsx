"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { CHECK_ORDER, CHECK_LABELS, type WordPressScanReport, type ScanFinding } from "@/lib/wordpressScan/shared";

// This scan's own findings come back from the API as a per-scan snapshot, but each one may
// carry an extra findingId/auditorNote pair when the API could match it back to its
// persistent WordPressFindings tracker row (see the scans/[id] route) - that's what lets this
// per-scan report view offer the same "Reason if unresolved" note the Findings tab does.
type FindingWithNote = ScanFinding & { findingId?: number; auditorNote?: string | null };

// Loose dotted-version "is a behind b" check - same shape as the server-side compareVersions
// in checks.ts, duplicated client-side since this is purely a display decision (which badge
// to show), not a network call.
function isBehind(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff < 0;
  }
  return false;
}

const upgradeBadgeStyle: CSSProperties = {
  marginLeft: "0.4rem",
  display: "inline-block",
  padding: "0.1rem 0.5rem",
  borderRadius: 999,
  fontSize: "0.72rem",
  fontWeight: 700,
  background: "var(--danger)",
  color: "#fff",
};

function riskColor(risk: string): string {
  if (risk === "critical" || risk === "high") return "var(--danger)";
  if (risk === "medium" || risk === "low") return "var(--warning)";
  if (risk === "info") return "var(--success)";
  return "var(--ink-muted)";
}

function severityColor(severity: string): string {
  if (severity === "critical" || severity === "high") return "var(--danger)";
  if (severity === "medium" || severity === "low") return "var(--warning)";
  return "var(--ink-muted)";
}

function RiskBadge({ risk }: { risk: string }) {
  const color = riskColor(risk);
  return (
    <span
      style={{
        fontSize: "0.75rem",
        fontWeight: 700,
        textTransform: "uppercase",
        padding: "0.25rem 0.6rem",
        borderRadius: 999,
        color,
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
      }}
    >
      {risk}
    </span>
  );
}

function PdfLinks({ scanId }: { scanId: number | null }) {
  if (!scanId) return null;
  return (
    <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.8rem" }}>
      <a href={`/api/admin/wordpress-scan/scans/${scanId}/pdf?view=1`} target="_blank" rel="noreferrer" style={{ color: "var(--series-1)" }}>
        View PDF
      </a>
      <a href={`/api/admin/wordpress-scan/scans/${scanId}/pdf`} style={{ color: "var(--series-1)" }}>
        Download PDF
      </a>
    </div>
  );
}

function ReportView({
  report,
  scanId,
  savingNoteId,
  onOpenNote,
}: {
  report: WordPressScanReport;
  scanId: number | null;
  savingNoteId: number | null;
  onOpenNote: (findingId: number, currentValue: string | null | undefined) => void;
}) {
  if (!report.isWordPress) {
    return (
      <div className="dash-panel" style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
          <p style={{ color: report.blockReason ? "var(--warning)" : "var(--ink-muted)", margin: 0 }}>
            {report.blockReason ? (
              <>
                Scan blocked at <strong>{report.targetUrl}</strong>: {report.blockReason}
              </>
            ) : (
              <>
                WordPress was not detected at <strong>{report.targetUrl}</strong> — no wp-content/wp-includes/wp-json markers found.
              </>
            )}
          </p>
          <PdfLinks scanId={scanId} />
        </div>
      </div>
    );
  }

  const checksByCheck = new Map(report.checks.map((c) => [c.check, c]));
  const coreOutdated = isBehind(report.coreVersion, report.latestCoreVersion);
  const phpTooOld = isBehind(report.phpVersion, report.corePhpRequirement);

  return (
    <div className="dash-panel" style={{ marginTop: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "grid", gap: "0.3rem", fontSize: "0.85rem" }}>
          <div>
            <span style={{ color: "var(--ink-muted)" }}>Site:</span>{" "}
            <a href={report.targetUrl} target="_blank" rel="noreferrer">
              {report.targetUrl}
            </a>
          </div>
          <div>
            <span style={{ color: "var(--ink-muted)" }}>Core version:</span> {report.coreVersion ?? "unknown"}
            {coreOutdated ? (
              <span className="vuln-badge" style={upgradeBadgeStyle}>
                upgrade to {report.latestCoreVersion}
              </span>
            ) : (
              report.latestCoreVersion && (
                <span style={{ color: "var(--success)", fontSize: "0.78rem", marginLeft: "0.4rem" }}>up to date (latest {report.latestCoreVersion})</span>
              )
            )}
          </div>
          <div>
            <span style={{ color: "var(--ink-muted)" }}>PHP version:</span> {report.phpVersion ?? "unknown (not linked to a saved website)"}
            {phpTooOld && (
              <span className="vuln-badge" style={upgradeBadgeStyle}>
                upgrade to {report.corePhpRequirement}+
              </span>
            )}
          </div>
          <div>
            <span style={{ color: "var(--ink-muted)" }}>Active theme:</span>{" "}
            {report.themeSlug ? `${report.themeSlug}${report.themeVersion ? ` v${report.themeVersion}` : ""}` : "unknown"}
          </div>
          <div>
            <span style={{ color: "var(--ink-muted)" }}>Scanned:</span> {new Date(report.scannedAt).toLocaleString()}
          </div>
        </div>
        <div style={{ display: "grid", gap: "0.5rem", justifyItems: "end" }}>
          <RiskBadge risk={report.riskLevel} />
          <PdfLinks scanId={scanId} />
        </div>
      </div>

      <h3 style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Plugins ({report.plugins.length})</h3>
      <div style={{ overflowX: "auto", marginBottom: "1.25rem" }}>
        {report.plugins.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>
            None detected from page assets — plugins that only run server-side (caching, security, SEO) leave no trace here.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.4rem" }}>Plugin</th>
                <th style={{ padding: "0.4rem" }}>Version</th>
              </tr>
            </thead>
            <tbody>
              {report.plugins.map((p) => (
                <tr key={p.slug} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>{p.slug}</td>
                  <td style={{ padding: "0.4rem" }}>{p.version ?? "unknown"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h3 style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Checks</h3>
      <div style={{ overflowX: "auto", marginBottom: "1.25rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.4rem" }}>Check</th>
              <th style={{ padding: "0.4rem" }}>Status</th>
              <th style={{ padding: "0.4rem" }}>Findings</th>
            </tr>
          </thead>
          <tbody>
            {CHECK_ORDER.map((id) => {
              const c = checksByCheck.get(id);
              const status = c?.status ?? "not_applicable";
              const color = status === "issues_found" ? "var(--danger)" : status === "error" ? "var(--warning)" : "var(--success)";
              const label = status === "issues_found" ? "Issues found" : status === "error" ? "Check failed" : status === "ok" ? "Clear" : "Not run";
              return (
                <tr key={id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>{CHECK_LABELS[id]}</td>
                  <td style={{ padding: "0.4rem", color }}>{label}</td>
                  <td style={{ padding: "0.4rem" }}>{c?.findingCount ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {report.findings.length > 0 && (
        <div>
          <h3 style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Findings</h3>
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {(report.findings as FindingWithNote[]).map((f, i) => (
              <div key={i} style={{ fontSize: "0.82rem", borderLeft: `3px solid ${severityColor(f.severity)}`, paddingLeft: "0.6rem" }}>
                <div>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: severityColor(f.severity),
                      marginRight: "0.5rem",
                    }}
                  >
                    {f.severity}
                  </span>
                  <strong>{f.title}</strong>
                </div>
                {f.detail && <div style={{ color: "var(--ink-muted)", marginTop: "0.15rem" }}>{f.detail}</div>}
                {f.evidence && (
                  <div style={{ marginTop: "0.15rem" }}>
                    <a href={f.evidence} target="_blank" rel="noreferrer" style={{ fontSize: "0.78rem" }}>
                      Reference
                    </a>
                  </div>
                )}
                {f.recommendation && <div style={{ color: "var(--ink-muted)", marginTop: "0.15rem" }}>Fix: {f.recommendation}</div>}
                {f.findingId != null && (
                  <div style={{ marginTop: "0.3rem" }}>
                    <button
                      type="button"
                      onClick={() => onOpenNote(f.findingId as number, f.auditorNote)}
                      disabled={savingNoteId === f.findingId}
                      style={{
                        background: "none",
                        border: "1px dashed var(--border)",
                        borderRadius: 6,
                        padding: "0.3rem 0.5rem",
                        color: f.auditorNote ? "var(--ink)" : "var(--ink-muted)",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                        textAlign: "left",
                        maxWidth: 480,
                      }}
                    >
                      {f.auditorNote ? `Reason: ${f.auditorNote.slice(0, 80)}${f.auditorNote.length > 80 ? "…" : ""} (edit)` : "+ Add reason if unresolved"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function WordPressScanDetailClient({ scanId }: { scanId: number }) {
  const [report, setReport] = useState<WordPressScanReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteModalFindingId, setNoteModalFindingId] = useState<number | null>(null);
  const [noteModalDraft, setNoteModalDraft] = useState("");
  const [savingNoteId, setSavingNoteId] = useState<number | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/wordpress-scan/scans/${scanId}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to load scan.");
      } else {
        setReport(data.report);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scan.");
    } finally {
      setLoading(false);
    }
  }

  function openNoteModal(findingId: number, currentValue: string | null | undefined) {
    setNoteModalFindingId(findingId);
    setNoteModalDraft(currentValue ?? "");
  }

  async function saveFindingNote() {
    const findingId = noteModalFindingId;
    if (findingId == null) return;
    const currentValue = (report?.findings as FindingWithNote[] | undefined)?.find((f) => f.findingId === findingId)?.auditorNote ?? null;
    const note = noteModalDraft.trim() ? noteModalDraft.trim().slice(0, 500) : null;
    if (note === currentValue) {
      setNoteModalFindingId(null);
      return; // unchanged, nothing to save
    }

    setSavingNoteId(findingId);
    const prevReport = report;
    setReport((r) =>
      r ? { ...r, findings: (r.findings as FindingWithNote[]).map((f) => (f.findingId === findingId ? { ...f, auditorNote: note } : f)) } : r
    );
    try {
      const res = await fetch(`/api/admin/wordpress-scan/findings/${findingId}/note`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (!data.ok) {
        setReport(prevReport); // revert optimistic update on failure
        setError(data.error ?? "Failed to save reason.");
      } else {
        setNoteModalFindingId(null);
      }
    } catch (err) {
      setReport(prevReport);
      setError(err instanceof Error ? err.message : "Failed to save reason.");
    } finally {
      setSavingNoteId(null);
    }
  }

  return (
    <div>
      <Link href="/dashboard/audit/wordpress-scan" style={{ fontSize: "0.82rem", color: "var(--series-1)" }}>
        ← Back to WordPress Deep Scan
      </Link>

      {error && (
        <div className="error" style={{ marginTop: "0.75rem" }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--ink-muted)", marginTop: "0.75rem" }}>Loading...</p>
      ) : report ? (
        <ReportView report={report} scanId={scanId} savingNoteId={savingNoteId} onOpenNote={openNoteModal} />
      ) : null}

      <Modal
        open={noteModalFindingId !== null}
        onClose={() => setNoteModalFindingId(null)}
        title="Reason if unresolved"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setNoteModalFindingId(null)}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.45rem 1rem", color: "var(--ink)", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              className="submit"
              onClick={saveFindingNote}
              disabled={savingNoteId === noteModalFindingId}
              style={{ width: "auto", padding: "0.45rem 1.25rem" }}
            >
              {savingNoteId === noteModalFindingId ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <textarea
          autoFocus
          value={noteModalDraft}
          onChange={(e) => setNoteModalDraft(e.target.value)}
          placeholder="Why this can't be fixed yet..."
          rows={5}
          maxLength={500}
          style={{
            width: "100%",
            padding: "0.5rem 0.65rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--plane)",
            color: "var(--ink)",
            fontSize: "0.88rem",
            fontFamily: "inherit",
            resize: "vertical",
          }}
        />
      </Modal>
    </div>
  );
}
