"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { rowsToCsv } from "@/lib/csv";

interface ReportColumn {
  key: string;
  label: string;
}

interface ReportSourceDef {
  key: string;
  label: string;
  description: string;
  columns: ReportColumn[];
  usesDays: boolean;
}

interface SavedTemplate {
  id: number;
  name: string;
  sourceKey: string;
  selectedColumns: string[];
  days: number | null;
}

export function ReportBuilderClient({ sources }: { sources: ReportSourceDef[] }) {
  const [sourceKey, setSourceKey] = useState(sources[0]?.key ?? "");
  const [days, setDays] = useState(30);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(sources[0]?.columns.map((c) => c.key) ?? []);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [running, setRunning] = useState(false);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const source = sources.find((s) => s.key === sourceKey);

  useEffect(() => {
    fetch("/api/admin/reports/templates")
      .then((res) => res.json())
      .then((data: { ok: boolean; templates?: SavedTemplate[] }) => {
        if (data.ok && data.templates) setTemplates(data.templates);
      })
      .catch(() => {});
  }, []);

  function handleSourceChange(key: string) {
    setSourceKey(key);
    const next = sources.find((s) => s.key === key);
    setSelectedColumns(next?.columns.map((c) => c.key) ?? []);
    setRows(null);
  }

  function toggleColumn(key: string) {
    setSelectedColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function runReport() {
    setRunning(true);
    try {
      const res = await fetch("/api/admin/reports/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceKey, days }),
      });
      const data: { ok: boolean; rows?: Record<string, unknown>[] } = await res.json();
      if (data.ok && data.rows) setRows(data.rows);
      else setRows([]);
    } catch {
      setRows([]);
    } finally {
      setRunning(false);
    }
  }

  function exportCsv() {
    if (!rows || !source) return;
    const headers = source.columns.filter((c) => selectedColumns.includes(c.key)).map((c) => c.label);
    const csv = rowsToCsv(
      headers,
      rows.map((r) => source.columns.filter((c) => selectedColumns.includes(c.key)).map((c) => formatCell(r[c.key])))
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${source.key}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function saveTemplate() {
    const name = templateName.trim();
    if (!name) return;
    setSavingTemplate(true);
    try {
      const res = await fetch("/api/admin/reports/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sourceKey, selectedColumns, days: source?.usesDays ? days : null }),
      });
      if (res.ok) {
        setTemplateName("");
        const refreshed = await fetch("/api/admin/reports/templates").then((r) => r.json());
        if (refreshed.ok) setTemplates(refreshed.templates);
      }
    } catch {
      // Keep the typed name so the admin can just retry.
    } finally {
      setSavingTemplate(false);
    }
  }

  function loadTemplate(t: SavedTemplate) {
    setSourceKey(t.sourceKey);
    setSelectedColumns(t.selectedColumns);
    if (t.days) setDays(t.days);
    setRows(null);
  }

  async function deleteTemplate(id: number) {
    await fetch(`/api/admin/reports/templates/${id}`, { method: "DELETE" }).catch(() => {});
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      {templates.length > 0 && (
        <Card>
          <h2 style={{ fontSize: "0.9rem", marginTop: 0, marginBottom: "0.5rem" }}>Saved Templates</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {templates.map((t) => (
              <span key={t.id} className="flex items-center gap-1" style={{ border: "1px solid var(--border)", borderRadius: 999, padding: "0.25rem 0.4rem 0.25rem 0.7rem", fontSize: "0.78rem" }}>
                <button type="button" onClick={() => loadTemplate(t)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink)" }}>
                  {t.name}
                </button>
                <button type="button" onClick={() => deleteTemplate(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)" }}>
                  ×
                </button>
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <div style={{ minWidth: 220 }}>
            <Select value={sourceKey} onChange={handleSourceChange} options={sources.map((s) => ({ label: s.label, value: s.key }))} />
          </div>
          {source?.usesDays && (
            <div className="flex items-center gap-2">
              <label style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>Last</label>
              <input
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                style={{ width: 70, padding: "0.4rem 0.5rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)" }}
              />
              <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>days</span>
            </div>
          )}
          <Button size="sm" onClick={runReport} disabled={running}>
            {running ? "Running..." : "Run Report"}
          </Button>
          {rows && rows.length > 0 && (
            <Button size="sm" variant="secondary" onClick={exportCsv}>
              Export CSV
            </Button>
          )}
        </div>
        {source && (
          <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginTop: "0.5rem", marginBottom: 0 }}>{source.description}</p>
        )}
        {source && (
          <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: "0.75rem" }}>
            {source.columns.map((c) => (
              <label key={c.key} className="flex items-center gap-1" style={{ fontSize: "0.8rem", color: "var(--ink)" }}>
                <input type="checkbox" checked={selectedColumns.includes(c.key)} onChange={() => toggleColumn(c.key)} />
                {c.label}
              </label>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2" style={{ marginTop: "0.75rem" }}>
          <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Template name"
            style={{ padding: "0.4rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.82rem", width: 180 }}
          />
          <Button size="sm" variant="secondary" onClick={saveTemplate} disabled={savingTemplate || !templateName.trim()}>
            {savingTemplate ? "Saving..." : "Save as Template"}
          </Button>
        </div>
      </Card>

      {rows && source && (
        <Card>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  {source.columns
                    .filter((c) => selectedColumns.includes(c.key))
                    .map((c) => (
                      <th key={c.key} style={{ padding: "0.4rem" }}>
                        {c.label}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--grid)" }}>
                    {source.columns
                      .filter((c) => selectedColumns.includes(c.key))
                      .map((c) => (
                        <td key={c.key} style={{ padding: "0.4rem" }}>
                          {formatCell(r[c.key])}
                        </td>
                      ))}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={selectedColumns.length || 1} style={{ padding: "1rem", textAlign: "center", color: "var(--ink-muted)" }}>
                      No rows.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}
