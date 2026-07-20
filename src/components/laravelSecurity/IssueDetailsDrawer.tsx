"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { CategoryBadge, IssueStatusBadge, SeverityBadge } from "./badges";

interface IssueDetail {
  Id: number;
  IssueNumber: string | null;
  Title: string;
  Description: string | null;
  Category: string;
  RuleCode: string | null;
  FilePath: string;
  StartLine: number | null;
  EndLine: number | null;
  CodeElement: string | null;
  Severity: string;
  Status: string;
  ConfidenceLevel: string | null;
  Recommendation: string | null;
  CodeSnippet: string | null;
  ResolutionNote: string | null;
  ProjectId: number;
  ProjectName: string;
  ScanId: number;
  ScanBranch: string | null;
  ScanStartedAt: string | null;
  ResolvedByUsername: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.65rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};
const labelRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", fontSize: "0.8rem", padding: "0.3rem 0", borderBottom: "1px solid var(--border)" };

export function IssueDetailsDrawer({
  issueId,
  onClose,
  canUpdate,
  onUpdated,
}: {
  issueId: number;
  onClose: () => void;
  canUpdate?: boolean;
  onUpdated?: () => void;
}) {
  const toast = useToast();
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [status, setStatus] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/laravel-security/issues/${issueId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) return;
        setIssue(data.data);
        setStatus(data.data.Status);
        setResolutionNote(data.data.ResolutionNote ?? "");
      });
  }, [issueId]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/laravel-security/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolutionNote: resolutionNote || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to update issue.");
      toast.show({ type: "success", message: "Issue updated." });
      onUpdated?.();
      onClose();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to update issue." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={issue ? `${issue.IssueNumber ?? `Issue #${issue.Id}`}` : "Issue"} size="lg">
      {!issue ? (
        <div className="flex flex-col gap-2">
          <Skeleton height={20} />
          <Skeleton height={80} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <h3 style={{ margin: "0 0 0.4rem", fontSize: "1.05rem" }}>{issue.Title}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <CategoryBadge category={issue.Category} />
              <SeverityBadge severity={issue.Severity} />
              <IssueStatusBadge status={issue.Status} />
            </div>
          </div>

          {issue.Description && <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--ink-secondary)" }}>{issue.Description}</p>}

          <div>
            <div style={labelRow}>
              <span style={{ color: "var(--ink-muted)" }}>Project</span>
              <Link href={`/dashboard/laravel-security/projects/${issue.ProjectId}`} style={{ color: "var(--primary)", textDecoration: "none" }}>{issue.ProjectName}</Link>
            </div>
            <div style={labelRow}>
              <span style={{ color: "var(--ink-muted)" }}>Scan</span>
              <Link href={`/dashboard/laravel-security/scans/${issue.ScanId}`} style={{ color: "var(--primary)", textDecoration: "none" }}>#{issue.ScanId} ({issue.ScanBranch || "—"})</Link>
            </div>
            <div style={labelRow}>
              <span style={{ color: "var(--ink-muted)" }}>File</span>
              <span style={{ fontFamily: "monospace" }}>{issue.FilePath}{issue.StartLine ? `:${issue.StartLine}` : ""}</span>
            </div>
            {issue.CodeElement && (
              <div style={labelRow}>
                <span style={{ color: "var(--ink-muted)" }}>Code Element</span>
                <span style={{ fontFamily: "monospace" }}>{issue.CodeElement}</span>
              </div>
            )}
            {issue.RuleCode && (
              <div style={labelRow}>
                <span style={{ color: "var(--ink-muted)" }}>Rule</span>
                <span>{issue.RuleCode}</span>
              </div>
            )}
            {issue.ConfidenceLevel && (
              <div style={labelRow}>
                <span style={{ color: "var(--ink-muted)" }}>Confidence</span>
                <span>{issue.ConfidenceLevel}</span>
              </div>
            )}
            <div style={labelRow}>
              <span style={{ color: "var(--ink-muted)" }}>Detected</span>
              <span>{new Date(issue.CreatedAt).toLocaleString()}</span>
            </div>
            {issue.ResolvedByUsername && (
              <div style={{ ...labelRow, borderBottom: "none" }}>
                <span style={{ color: "var(--ink-muted)" }}>Resolved By</span>
                <span>{issue.ResolvedByUsername}</span>
              </div>
            )}
          </div>

          {issue.CodeSnippet && (
            <div>
              <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.3rem" }}>Code Snippet</div>
              {/* React escapes text content automatically - safe against HTML injection from a
                  scanned file's own source text, same reasoning as Code Quality's own
                  IssueDetailsDrawer. */}
              <pre style={{ margin: 0, padding: "0.75rem", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: "0.76rem", overflowX: "auto", whiteSpace: "pre" }}>
                {issue.CodeSnippet}
              </pre>
            </div>
          )}

          {issue.Recommendation && (
            <div>
              <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.3rem" }}>Recommended Fix</div>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>{issue.Recommendation}</p>
            </div>
          )}

          {canUpdate && (
            <div className="flex flex-col gap-2" style={{ paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.3rem", display: "block" }}>Status</label>
                <select style={fieldStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {["Open", "Confirmed", "Resolved", "Ignored", "FalsePositive"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.3rem", display: "block" }}>Resolution Note</label>
                <textarea style={{ ...fieldStyle, resize: "vertical", minHeight: 70 }} value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} maxLength={2000} />
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
