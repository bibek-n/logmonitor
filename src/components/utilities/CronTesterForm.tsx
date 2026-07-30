"use client";

import { useState } from "react";
import { nextRunTimes } from "@/lib/utilities/cron";

const inputStyle = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--plane)",
  color: "var(--ink)",
  fontSize: "0.95rem",
  fontFamily: "monospace",
};

const PRESETS = [
  { label: "Every minute", expr: "* * * * *" },
  { label: "Every 5 minutes", expr: "*/5 * * * *" },
  { label: "Every hour", expr: "0 * * * *" },
  { label: "Every day at midnight", expr: "0 0 * * *" },
  { label: "Every Monday at 9am", expr: "0 9 * * 1" },
];

export default function CronTesterForm() {
  const [expr, setExpr] = useState("*/15 * * * *");
  const [runs, setRuns] = useState<Date[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    try {
      setRuns(nextRunTimes(expr, 10));
    } catch (err) {
      setRuns(null);
      setError(err instanceof Error ? err.message : "Invalid cron expression.");
    }
  }

  return (
    <div className="dash-panel">
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ marginBottom: 0, flex: "1 1 260px" }}>
          <label htmlFor="expr">Cron Expression (minute hour day-of-month month day-of-week)</label>
          <input id="expr" value={expr} onChange={(e) => setExpr(e.target.value)} style={inputStyle} />
        </div>
        <button className="submit" type="button" onClick={run} style={{ width: "auto", padding: "0.6rem 1.25rem" }}>
          Test
        </button>
      </div>

      <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {PRESETS.map((p) => (
          <button
            key={p.expr}
            type="button"
            onClick={() => setExpr(p.expr)}
            style={{
              fontSize: "0.78rem",
              padding: "0.3rem 0.65rem",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--plane)",
              color: "var(--ink-muted)",
              cursor: "pointer",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="error" style={{ marginTop: "1rem" }}>
          {error}
        </div>
      )}

      {runs && (
        <div style={{ marginTop: "1rem" }}>
          <strong style={{ fontSize: "0.85rem" }}>Next 10 run times</strong>
          <ol style={{ marginTop: "0.5rem", paddingLeft: "1.25rem", fontFamily: "monospace", fontSize: "0.85rem" }}>
            {runs.map((d, i) => (
              <li key={i}>{d.toString()}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
