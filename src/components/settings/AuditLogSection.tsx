"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";

interface AuditRow {
  Id: number;
  Username: string;
  Section: string;
  Action: string;
  Details: string | null;
  IpAddress: string | null;
  CreatedAt: string;
}

export function AuditLogSection({ rows }: { rows: AuditRow[] }) {
  const [sectionFilter, setSectionFilter] = useState("");

  const sectionOptions = useMemo(() => {
    const sections = Array.from(new Set(rows.map((r) => r.Section)));
    return sections.map((s) => ({ label: s.replace(/_/g, " "), value: s }));
  }, [rows]);

  const filtered = sectionFilter ? rows.filter((r) => r.Section === sectionFilter) : rows;

  return (
    <Card className="flex flex-col gap-3" id="field-audit-logs">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 style={{ fontSize: "1rem", margin: 0, color: "var(--ink)" }}>Audit Logs</h2>
        <div style={{ minWidth: 200 }}>
          <Select value={sectionFilter} onChange={setSectionFilter} options={sectionOptions} placeholder="All sections" />
        </div>
      </div>
      <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", margin: 0 }}>
        Every save made from this Company Settings page is recorded here — who changed what, and when.
      </p>
      <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              {["User", "Section", "Action", "Details", "IP", "When"].map((h) => (
                <th key={h} style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.Id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.4rem 0.6rem" }}>{r.Username}</td>
                <td style={{ padding: "0.4rem 0.6rem" }}>
                  <Badge tone="neutral">{r.Section.replace(/_/g, " ")}</Badge>
                </td>
                <td style={{ padding: "0.4rem 0.6rem" }}>{r.Action.replace(/_/g, " ")}</td>
                <td style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)" }}>{r.Details ?? "—"}</td>
                <td style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)" }}>{r.IpAddress ?? "—"}</td>
                <td style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)" }}>{r.CreatedAt.replace("T", " ")}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "1rem", textAlign: "center", color: "var(--ink-muted)" }}>
                  No audit entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
