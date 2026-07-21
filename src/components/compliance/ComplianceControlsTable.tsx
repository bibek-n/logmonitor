"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";

interface Control {
  Id: number;
  ControlCode: string;
  Category: string;
  Title: string;
  Description: string | null;
  AutoCheckKey: string | null;
  Status: string;
  Evidence: string | null;
  Notes: string | null;
  ReviewedAt: string | null;
  AutoCheckStatus: string | null;
  AutoCheckDetail: string | null;
  AutoCheckedAt: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  implemented: "Implemented",
  not_applicable: "Not Applicable",
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  implemented: "success",
  in_progress: "warning",
  not_started: "danger",
  not_applicable: "neutral",
};

const AUTO_CHECK_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  pass: "success",
  fail: "danger",
  unknown: "neutral",
};

const cellStyle: React.CSSProperties = { padding: "0.5rem" };

export function ComplianceControlsTable({ controls }: { controls: Control[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="dash-panel">
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={cellStyle}>Control</th>
              <th style={cellStyle}>Category</th>
              <th style={cellStyle}>Title</th>
              <th style={cellStyle}>Auto-Check</th>
              <th style={cellStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {controls.map((c) => (
              <ControlRow key={c.Id} control={c} expanded={expandedId === c.Id} onToggle={() => setExpandedId(expandedId === c.Id ? null : c.Id)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ControlRow({ control, expanded, onToggle }: { control: Control; expanded: boolean; onToggle: () => void }) {
  const router = useRouter();
  const [status, setStatus] = useState(control.Status);
  const [evidence, setEvidence] = useState(control.Evidence ?? "");
  const [notes, setNotes] = useState(control.Notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/compliance/controls/${control.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Update failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function onStatusChange(newStatus: string) {
    setStatus(newStatus);
    await patch({ status: newStatus });
  }

  async function saveDetails() {
    await patch({ evidence, notes, markReviewed: true });
  }

  return (
    <>
      <tr style={{ borderBottom: "1px solid var(--grid)", cursor: "pointer" }} onClick={onToggle}>
        <td style={{ ...cellStyle, fontFamily: "monospace", whiteSpace: "nowrap" }}>{control.ControlCode}</td>
        <td style={cellStyle}>{control.Category}</td>
        <td style={cellStyle}>{control.Title}</td>
        <td style={cellStyle}>
          {control.AutoCheckKey ? (
            <Badge tone={control.AutoCheckStatus ? AUTO_CHECK_TONE[control.AutoCheckStatus] : "neutral"}>
              {control.AutoCheckStatus ? control.AutoCheckStatus : "not run"}
            </Badge>
          ) : (
            <span style={{ color: "var(--ink-muted)" }}>—</span>
          )}
        </td>
        <td style={cellStyle} onClick={(e) => e.stopPropagation()}>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            disabled={saving}
            style={{ padding: "0.25rem 0.5rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.8rem" }}
          >
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <Badge tone={STATUS_TONE[status]} className="ml-2">
            {STATUS_LABELS[status]}
          </Badge>
        </td>
      </tr>
      {expanded && (
        <tr style={{ borderBottom: "1px solid var(--grid)" }}>
          <td colSpan={5} style={{ padding: "0.75rem 0.75rem 1rem", background: "var(--plane)" }} onClick={(e) => e.stopPropagation()}>
            <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem", margin: "0 0 0.6rem" }}>{control.Description}</p>
            {control.AutoCheckKey && (
              <p style={{ fontSize: "0.8rem", margin: "0 0 0.75rem" }}>
                <strong>Auto-check:</strong> {control.AutoCheckDetail ?? "Not run yet."}
                {control.AutoCheckedAt && <span style={{ color: "var(--ink-muted)" }}> (as of {control.AutoCheckedAt})</span>}
              </p>
            )}
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", display: "block", marginBottom: "0.25rem" }}>Evidence</label>
                <textarea
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  rows={3}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.82rem" }}
                  placeholder="Link, file path, or description of evidence supporting this control's status..."
                />
              </div>
              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", display: "block", marginBottom: "0.25rem" }}>Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.82rem" }}
                  placeholder="Notes, exceptions, remediation plan..."
                />
              </div>
            </div>
            <div className="flex items-center gap-2" style={{ marginTop: "0.6rem" }}>
              <button
                type="button"
                onClick={saveDetails}
                disabled={saving}
                className="submit"
                style={{ width: "auto", marginTop: 0, padding: "0.4rem 0.9rem", fontSize: "0.82rem", opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "Saving..." : "Save & Mark Reviewed"}
              </button>
              {control.ReviewedAt && <span style={{ color: "var(--ink-muted)", fontSize: "0.76rem" }}>Last reviewed: {control.ReviewedAt}</span>}
              {error && <span style={{ color: "var(--danger)", fontSize: "0.8rem" }}>{error}</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
