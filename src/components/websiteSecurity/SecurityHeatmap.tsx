"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Tooltip } from "@/components/ui/Tooltip";
import type { ScoreModule } from "@/lib/websiteSecurityAudit/types";

const MODULE_LABELS: [ScoreModule, string][] = [
  ["headers", "Headers"],
  ["ssl", "SSL/TLS"],
  ["auth", "Auth"],
  ["cookies", "Cookies"],
  ["js", "JS/Deps"],
  ["dns", "DNS"],
  ["email", "Email"],
  ["server", "Server"],
  ["owasp", "OWASP"],
  ["performance", "Perf"],
];

export interface HeatmapRow {
  websiteId: number;
  websiteName: string;
  scanDate: string | null;
  moduleScores: Record<ScoreModule, number>;
}

function cellColor(score: number): string {
  if (score < 40) return "var(--danger)";
  if (score < 60) return "var(--warning)";
  if (score < 80) return "var(--info)";
  return "var(--success)";
}

// Site x module grid, colored by the same deduct-from-100 score every other part of this
// feature uses - gives an at-a-glance "which sites, which modules" view that the per-site
// detail panel below can't show without clicking into every website one at a time.
export function SecurityHeatmap({ rows, onSelectWebsite }: { rows: HeatmapRow[]; onSelectWebsite: (id: number) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const scanned = rows.filter((r) => r.scanDate !== null);
  if (scanned.length === 0) return null;

  return (
    <Card className="flex flex-col gap-3" style={{ marginBottom: "1.25rem" }}>
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: "1rem", margin: 0, color: "var(--ink)" }}>Security Heatmap</h2>
        <button
          onClick={() => setCollapsed((c) => !c)}
          style={{ background: "none", border: "none", color: "var(--series-1)", cursor: "pointer", fontSize: "0.8rem" }}
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>
      {!collapsed && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr>
                <th style={{ padding: "0.3rem 0.5rem", textAlign: "left", color: "var(--ink-muted)", position: "sticky", left: 0, background: "var(--surface)" }}>Website</th>
                {MODULE_LABELS.map(([key, label]) => (
                  <th key={key} style={{ padding: "0.3rem 0.4rem", color: "var(--ink-muted)", fontWeight: 500, textAlign: "center" }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scanned.map((row) => (
                <tr key={row.websiteId}>
                  <td style={{ padding: "0.3rem 0.5rem", position: "sticky", left: 0, background: "var(--surface)" }}>
                    <button
                      onClick={() => onSelectWebsite(row.websiteId)}
                      style={{ background: "none", border: "none", color: "var(--series-1)", cursor: "pointer", padding: 0, font: "inherit", textAlign: "left", whiteSpace: "nowrap" }}
                    >
                      {row.websiteName}
                    </button>
                  </td>
                  {MODULE_LABELS.map(([key, label]) => {
                    const score = row.moduleScores[key];
                    const color = cellColor(score);
                    return (
                      <td key={key} style={{ padding: "0.2rem 0.3rem" }}>
                        <Tooltip content={`${label}: ${score}/100`}>
                          <div
                            style={{
                              width: "100%",
                              minWidth: 34,
                              height: 24,
                              borderRadius: 5,
                              background: `color-mix(in srgb, ${color} ${Math.max(18, 100 - score)}%, transparent)`,
                              border: `1px solid color-mix(in srgb, ${color} 55%, transparent)`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color,
                              fontWeight: 600,
                              fontSize: "0.72rem",
                            }}
                          >
                            {score}
                          </div>
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
