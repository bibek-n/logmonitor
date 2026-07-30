"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface ReportDefinition {
  key: string;
  title: string;
  description: string;
}

interface ReportPreview {
  title: string;
  columns: { header: string; key: string }[];
  rows: Record<string, string>[];
}

export function ReportsClient() {
  const [reports, setReports] = useState<ReportDefinition[] | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    fetch("/api/admin/it-asset-logsheet/reports")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setReports(data.data);
      });
  }, []);

  async function openPreview(key: string) {
    setActiveKey(key);
    setLoadingPreview(true);
    setPreview(null);
    const res = await fetch(`/api/admin/it-asset-logsheet/reports/${key}`);
    const data = await res.json();
    setLoadingPreview(false);
    if (res.ok && data.ok) setPreview(data.data);
  }

  function exportUrl(key: string, format: string): string {
    return `/api/admin/it-asset-logsheet/reports/${key}?format=${format}`;
  }

  if (reports === null) {
    return <p style={{ color: "var(--ink-muted)" }}>Loading reports...</p>;
  }

  return (
    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ display: "grid", gap: "0.6rem", flex: "1 1 360px", minWidth: 320 }}>
        {reports.map((r) => (
          <Card key={r.key} style={activeKey === r.key ? { borderColor: "var(--accent)" } : undefined}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{r.title}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>{r.description}</div>
              </div>
              <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <Button size="sm" variant="secondary" onClick={() => openPreview(r.key)}>Preview</Button>
                <a href={exportUrl(r.key, "csv")}><Button size="sm" variant="secondary">CSV</Button></a>
                <a href={exportUrl(r.key, "excel")}><Button size="sm" variant="secondary">Excel</Button></a>
                <a href={exportUrl(r.key, "pdf")}><Button size="sm" variant="secondary">PDF</Button></a>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="dash-panel" style={{ flex: "2 1 480px", minWidth: 340, minHeight: 200 }}>
        {!activeKey ? (
          <p style={{ color: "var(--ink-muted)" }}>Select a report to preview it here.</p>
        ) : loadingPreview ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading preview...</p>
        ) : !preview ? (
          <p style={{ color: "var(--danger)" }}>Failed to load report.</p>
        ) : (
          <>
            <h3 style={{ marginTop: 0, fontSize: "1rem" }}>{preview.title} ({preview.rows.length})</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                    {preview.columns.map((c) => (
                      <th key={c.key} style={{ padding: "0.4rem" }}>{c.header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.length === 0 ? (
                    <tr><td colSpan={preview.columns.length} style={{ padding: "0.6rem", color: "var(--ink-muted)" }}>No matching rows.</td></tr>
                  ) : (
                    preview.rows.slice(0, 200).map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--grid)" }}>
                        {preview.columns.map((c) => (
                          <td key={c.key} style={{ padding: "0.4rem" }}>{row[c.key] || "—"}</td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {preview.rows.length > 200 && (
                <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>Showing first 200 of {preview.rows.length} rows. Export for the full set.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
