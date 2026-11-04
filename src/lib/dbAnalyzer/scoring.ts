import type { Finding, RiskLevel, Severity } from "./types";

// Same deduct-from-100-by-severity shape as the other audit modules in this app (Website
// Security Audit, WordPress Deep Scan) - flat pool is fine here since Phase 1 has no fixed
// set of "modules" to average across yet.
const SEVERITY_DEDUCTION: Record<Severity, number> = {
  critical: 20,
  high: 12,
  medium: 6,
  low: 2,
  info: 0,
};

export function computeSecurityScore(findings: Finding[]): number {
  let score = 100;
  for (const f of findings) score -= SEVERITY_DEDUCTION[f.severity];
  return Math.max(0, Math.round(score));
}

export function riskLevelForScore(score: number): RiskLevel {
  if (score < 40) return "Critical";
  if (score < 60) return "High";
  if (score < 80) return "Medium";
  return "Low";
}
