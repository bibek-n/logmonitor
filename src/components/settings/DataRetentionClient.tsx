"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";

export interface RetentionRow {
  module: string;
  setting: string;
  days: number | null;
  href: string;
}

export function DataRetentionClient({ rows }: { rows: RetentionRow[] }) {
  return (
    <Card>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
              <th style={{ padding: "0.5rem" }}>Module</th>
              <th style={{ padding: "0.5rem" }}>What it governs</th>
              <th style={{ padding: "0.5rem" }}>Kept for</th>
              <th style={{ padding: "0.5rem" }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--grid)" }}>
                <td style={{ padding: "0.5rem" }}>{r.module}</td>
                <td style={{ padding: "0.5rem", color: "var(--ink-muted)" }}>{r.setting}</td>
                <td style={{ padding: "0.5rem" }}>
                  {r.days === null ? <span style={{ color: "var(--ink-muted)" }}>Not configured</span> : `${r.days} day${r.days === 1 ? "" : "s"}`}
                </td>
                <td style={{ padding: "0.5rem", textAlign: "right" }}>
                  <Link href={r.href} style={{ fontSize: "0.8rem", color: "var(--series-1)" }}>
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
