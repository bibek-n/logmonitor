"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";

interface SavedWebsite {
  Id: number;
  Name: string;
  Url: string;
}

interface FindingRow {
  Id: number;
  WebsiteId: number;
  WebsiteName: string;
  CheckId: string;
  Severity: string;
  Title: string;
  Detail: string | null;
  Status: string;
  AuditorNote: string | null;
  FirstSeenAt: string;
  LastSeenAt: string;
}

const STATUS_OPTIONS = ["Open", "InProgress", "Resolved", "AcceptedRisk", "FalsePositive"] as const;
const STATUS_LABELS: Record<string, string> = {
  Open: "Open",
  InProgress: "In Progress",
  Resolved: "Resolved",
  AcceptedRisk: "Accepted Risk",
  FalsePositive: "False Positive",
};
const SEVERITY_OPTIONS = ["critical", "high", "medium", "low", "info"];

function severityColor(severity: string): string {
  if (severity === "critical" || severity === "high") return "var(--danger)";
  if (severity === "medium" || severity === "low") return "var(--warning)";
  return "var(--ink-muted)";
}

export default function WordPressFindingsPanel({ websites }: { websites: SavedWebsite[] }) {
  const [rows, setRows] = useState<FindingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [websiteFilter, setWebsiteFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savingNoteId, setSavingNoteId] = useState<number | null>(null);
  const [noteModalId, setNoteModalId] = useState<number | null>(null);
  const [noteModalDraft, setNoteModalDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams({ page: String(p), pageSize: "25" });
      if (websiteFilter) sp.set("websiteId", websiteFilter);
      if (statusFilter) sp.set("status", statusFilter);
      if (severityFilter) sp.set("severity", severityFilter);
      const res = await fetch(`/api/admin/wordpress-scan/findings?${sp.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setRows(data.data);
        setTotalPages(data.pagination.totalPages);
        setPage(data.pagination.page);
      } else {
        setError(data.error ?? "Failed to load findings.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load findings.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteFilter, statusFilter, severityFilter]);

  useEffect(() => {
    load(1);
  }, [load]);

  async function changeStatus(id: number, status: string) {
    setSavingId(id);
    const prev = rows;
    setRows((r) => r.map((row) => (row.Id === id ? { ...row, Status: status } : row)));
    try {
      const res = await fetch(`/api/admin/wordpress-scan/findings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!data.ok) {
        setRows(prev); // revert optimistic update on failure
        setError(data.error ?? "Failed to update status.");
      }
    } catch (err) {
      setRows(prev);
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setSavingId(null);
    }
  }

  function openNoteModal(id: number, currentValue: string | null) {
    setNoteModalId(id);
    setNoteModalDraft(currentValue ?? "");
  }

  async function saveNote() {
    const id = noteModalId;
    if (id == null) return;
    const currentValue = rows.find((r) => r.Id === id)?.AuditorNote ?? null;
    const note = noteModalDraft.trim() ? noteModalDraft.trim().slice(0, 500) : null;
    if (note === currentValue) {
      setNoteModalId(null);
      return; // unchanged, nothing to save
    }

    setSavingNoteId(id);
    const prev = rows;
    setRows((r) => r.map((row) => (row.Id === id ? { ...row, AuditorNote: note } : row)));
    try {
      const res = await fetch(`/api/admin/wordpress-scan/findings/${id}/note`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (!data.ok) {
        setRows(prev); // revert optimistic update on failure
        setError(data.error ?? "Failed to save reason.");
      } else {
        setNoteModalId(null);
      }
    } catch (err) {
      setRows(prev);
      setError(err instanceof Error ? err.message : "Failed to save reason.");
    } finally {
      setSavingNoteId(null);
    }
  }

  const selectStyle: React.CSSProperties = {
    padding: "0.4rem 0.6rem",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--plane)",
    color: "var(--ink)",
    fontSize: "0.82rem",
  };

  return (
    <div className="dash-panel" style={{ marginTop: "0" }}>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <select value={websiteFilter} onChange={(e) => setWebsiteFilter(e.target.value)} style={selectStyle}>
          <option value="">All websites</option>
          {websites.map((w) => (
            <option key={w.Id} value={w.Id}>
              {w.Name}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={selectStyle}>
          <option value="">All severities</option>
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="error" style={{ marginBottom: "1rem" }}>{error}</div>}

      {loading ? (
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>No findings match these filters. Findings are tracked per saved website once it has at least one scan.</p>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "0.4rem" }}>Severity</th>
                  <th style={{ padding: "0.4rem" }}>Website</th>
                  <th style={{ padding: "0.4rem" }}>Finding</th>
                  <th style={{ padding: "0.4rem" }}>First seen</th>
                  <th style={{ padding: "0.4rem" }}>Last seen</th>
                  <th style={{ padding: "0.4rem" }}>Status</th>
                  <th style={{ padding: "0.4rem" }}>Reason if unresolved</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>
                      <span style={{ color: severityColor(row.Severity), fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase" }}>
                        {row.Severity}
                      </span>
                    </td>
                    <td style={{ padding: "0.4rem", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.WebsiteName}>
                      {row.WebsiteName}
                    </td>
                    <td style={{ padding: "0.4rem", maxWidth: 360 }}>
                      <div>{row.Title}</div>
                      {row.Detail && <div style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: "0.15rem" }}>{row.Detail}</div>}
                    </td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(row.FirstSeenAt).toLocaleDateString()}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(row.LastSeenAt).toLocaleDateString()}</td>
                    <td style={{ padding: "0.4rem" }}>
                      <select
                        value={row.Status}
                        disabled={savingId === row.Id}
                        onChange={(e) => changeStatus(row.Id, e.target.value)}
                        style={selectStyle}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: "0.4rem", minWidth: 200 }}>
                      <button
                        type="button"
                        onClick={() => openNoteModal(row.Id, row.AuditorNote)}
                        disabled={savingNoteId === row.Id}
                        style={{
                          background: "none",
                          border: "1px dashed var(--border)",
                          borderRadius: 6,
                          padding: "0.3rem 0.5rem",
                          color: row.AuditorNote ? "var(--ink)" : "var(--ink-muted)",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                          textAlign: "left",
                          width: "100%",
                        }}
                      >
                        {row.AuditorNote ? `${row.AuditorNote.slice(0, 60)}${row.AuditorNote.length > 60 ? "…" : ""} (edit)` : "+ Add reason"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", alignItems: "center", fontSize: "0.82rem" }}>
              <button type="button" disabled={page <= 1} onClick={() => load(page - 1)} style={{ ...selectStyle, cursor: page <= 1 ? "default" : "pointer" }}>
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => load(page + 1)}
                style={{ ...selectStyle, cursor: page >= totalPages ? "default" : "pointer" }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <Modal
        open={noteModalId !== null}
        onClose={() => setNoteModalId(null)}
        title="Reason if unresolved"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setNoteModalId(null)}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.45rem 1rem", color: "var(--ink)", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              className="submit"
              onClick={saveNote}
              disabled={savingNoteId === noteModalId}
              style={{ width: "auto", padding: "0.45rem 1.25rem" }}
            >
              {savingNoteId === noteModalId ? "Saving..." : "Save"}
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
