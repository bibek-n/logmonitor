"use client";

import { useCallback, useEffect, useState } from "react";
import { PROFILE_CHECKS, SCAN_PROFILE_LABELS, type ScanProfile } from "@/lib/wordpressScan/shared";

interface ScheduleRow {
  WebsiteId: number;
  WebsiteName: string;
  WebsiteUrl: string;
  ScheduleId: number | null;
  Recurrence: "daily" | "weekly" | "monthly" | null;
  Profile: ScanProfile | null;
  NextRunAt: string | null;
  LastRunAt: string | null;
  IsActive: boolean | null;
}

const RECURRENCE_OPTIONS = ["daily", "weekly", "monthly"] as const;
const PROFILE_OPTIONS: ScanProfile[] = ["quick", "standard", "comprehensive"];

const selectStyle: React.CSSProperties = {
  padding: "0.4rem 0.6rem",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--plane)",
  color: "var(--ink)",
  fontSize: "0.82rem",
};

export default function WordPressSchedulesPanel() {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  // Local draft state for rows with no schedule yet (ScheduleId === null) — nothing is saved
  // until "Enable" is clicked, so editing recurrence/profile for a not-yet-scheduled site
  // doesn't accidentally create a schedule.
  const [drafts, setDrafts] = useState<Record<number, { recurrence: "daily" | "weekly" | "monthly"; profile: ScanProfile }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/wordpress-scan/schedules");
      const data = await res.json();
      if (data.ok) setRows(data.data);
      else setError(data.error ?? "Failed to load schedules.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedules.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function draftFor(row: ScheduleRow) {
    return drafts[row.WebsiteId] ?? { recurrence: row.Recurrence ?? "weekly", profile: row.Profile ?? "standard" };
  }

  async function save(row: ScheduleRow, isActive: boolean) {
    setSavingId(row.WebsiteId);
    setError(null);
    const draft = draftFor(row);
    try {
      const res = await fetch("/api/admin/wordpress-scan/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId: row.WebsiteId, recurrence: draft.recurrence, profile: draft.profile, isActive }),
      });
      const data = await res.json();
      if (data.ok) await load();
      else setError(data.error ?? "Failed to save schedule.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save schedule.");
    } finally {
      setSavingId(null);
    }
  }

  async function remove(row: ScheduleRow) {
    setSavingId(row.WebsiteId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/wordpress-scan/schedules/${row.WebsiteId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) await load();
      else setError(data.error ?? "Failed to remove schedule.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove schedule.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="dash-panel" style={{ marginTop: "0" }}>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0 }}>
        Configure a recurring deep scan per WordPress site. A due schedule is picked up by the background scheduler within about 10-15 minutes.
      </p>
      {error && <div className="error" style={{ marginBottom: "1rem" }}>{error}</div>}
      {loading ? (
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>No WordPress sites found. Add one in the Websites list first.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.4rem" }}>Site</th>
                <th style={{ padding: "0.4rem" }}>Recurrence</th>
                <th style={{ padding: "0.4rem" }}>Profile</th>
                <th style={{ padding: "0.4rem" }}>Last run</th>
                <th style={{ padding: "0.4rem" }}>Next run</th>
                <th style={{ padding: "0.4rem" }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const draft = draftFor(row);
                const enabled = row.ScheduleId !== null && row.IsActive;
                const saving = savingId === row.WebsiteId;
                return (
                  <tr key={row.WebsiteId} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.WebsiteUrl}>
                      {row.WebsiteName}
                    </td>
                    <td style={{ padding: "0.4rem" }}>
                      <select
                        value={draft.recurrence}
                        disabled={saving}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [row.WebsiteId]: { ...draft, recurrence: e.target.value as typeof draft.recurrence } }))
                        }
                        style={selectStyle}
                      >
                        {RECURRENCE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: "0.4rem" }}>
                      <select
                        value={draft.profile}
                        disabled={saving}
                        onChange={(e) => setDrafts((d) => ({ ...d, [row.WebsiteId]: { ...draft, profile: e.target.value as ScanProfile } }))}
                        style={selectStyle}
                      >
                        {PROFILE_OPTIONS.map((p) => (
                          <option key={p} value={p}>
                            {SCAN_PROFILE_LABELS[p]} ({PROFILE_CHECKS[p].length})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{row.LastRunAt ? new Date(row.LastRunAt).toLocaleString() : "never"}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{enabled && row.NextRunAt ? new Date(row.NextRunAt).toLocaleString() : "-"}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                      {enabled ? (
                        <button type="button" disabled={saving} onClick={() => remove(row)} style={{ ...selectStyle, cursor: saving ? "default" : "pointer" }}>
                          Disable
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => save(row, true)}
                          style={{ ...selectStyle, background: "var(--primary)", color: "#fff", cursor: saving ? "default" : "pointer" }}
                        >
                          Enable
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
