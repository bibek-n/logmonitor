export type RiskLevel = "none" | "low" | "medium" | "high" | "blocked";

// Shared color mapping so the dashboard, events list, and security alerts page all render
// the same risk level with the same color - no per-page duplication.
export const RISK_TONE: Record<RiskLevel, { bg: string; fg: string }> = {
  none: { bg: "var(--surface-2)", fg: "var(--ink-muted)" },
  low: { bg: "rgba(34,197,94,0.15)", fg: "#22c55e" },
  medium: { bg: "rgba(234,179,8,0.15)", fg: "#eab308" },
  high: { bg: "rgba(239,68,68,0.15)", fg: "#ef4444" },
  blocked: { bg: "rgba(239,68,68,0.25)", fg: "#ef4444" },
};

export function riskBadgeStyle(risk: string): React.CSSProperties {
  const tone = RISK_TONE[risk as RiskLevel] ?? RISK_TONE.none;
  return {
    display: "inline-block",
    padding: "0.15rem 0.5rem",
    borderRadius: 999,
    fontSize: "0.72rem",
    fontWeight: 600,
    background: tone.bg,
    color: tone.fg,
    textTransform: "capitalize",
  };
}

export function formatDwell(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
}
