"use client";

import { useState } from "react";

// Live is red (handle with care - production), Dev is yellow, Staging is green - a
// deliberately non-standard traffic-light mapping (most dashboards color Live green for
// "healthy") chosen so the riskiest environment to touch is the one that visually screams
// loudest, not the calmest-looking one.
const ENVIRONMENT_COLORS: Record<string, { bg: string; fg: string }> = {
  Live: { bg: "var(--danger)", fg: "#fff" },
  Dev: { bg: "var(--warning)", fg: "#1a1a1a" },
  Staging: { bg: "var(--success)", fg: "#fff" },
};

const ENVIRONMENT_OPTIONS = ["Live", "Staging", "Dev"];

export function EnvironmentSelect({ id, name = "environment", defaultValue = "Live" }: { id: string; name?: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const colors = ENVIRONMENT_COLORS[value] ?? ENVIRONMENT_COLORS.Live;

  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      style={{
        background: colors.bg,
        color: colors.fg,
        fontWeight: 700,
        border: "none",
        borderRadius: 6,
        padding: "0.6rem 0.75rem",
        cursor: "pointer",
      }}
    >
      {ENVIRONMENT_OPTIONS.map((opt) => (
        <option key={opt} value={opt} style={{ background: "var(--surface)", color: "var(--ink)", fontWeight: 400 }}>
          {opt}
        </option>
      ))}
    </select>
  );
}
