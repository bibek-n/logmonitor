import { getDb } from "../db";

// Same deduct-from-100 shape as src/lib/websiteSecurityAudit/scoring.ts's
// computeSecurityScore() - a v1 heuristic aggregating across modules (not a claimed precise
// formula; weights are adjustable later). Each source module uses its own severity casing/enum
// (VulnerabilityFindings: Critical/High/Medium/Low/Informational, MalwareFindings:
// Critical/High/Medium/Low, SecurityAlerts (Intrusion Detection): critical/high/medium/low/
// informational) - normalized to a single lowercase key here before deduction.
const SEVERITY_DEDUCTION: Record<string, number> = {
  critical: 20,
  high: 12,
  medium: 6,
  low: 2,
  informational: 0,
};

export interface ComponentCounts {
  vulnerabilities: Record<string, number>;
  malware: Record<string, number>;
  intrusionAlerts: Record<string, number>;
}

export function deductionFor(counts: Record<string, number>): number {
  let deduction = 0;
  for (const [severity, count] of Object.entries(counts)) {
    deduction += (SEVERITY_DEDUCTION[severity.toLowerCase()] ?? 0) * count;
  }
  return deduction;
}

export function computeSecurityScore(counts: ComponentCounts): { overallScore: number; componentScores: Record<string, number> } {
  const vulnScore = Math.max(0, 100 - deductionFor(counts.vulnerabilities));
  const malwareScore = Math.max(0, 100 - deductionFor(counts.malware));
  const alertScore = Math.max(0, 100 - deductionFor(counts.intrusionAlerts));

  // Simple average across the three components - each module's own score stands on its own
  // (shown separately in the dashboard), the overall figure is just their mean.
  const overallScore = Math.max(0, Math.min(100, Math.round((vulnScore + malwareScore + alertScore) / 3)));

  return {
    overallScore,
    componentScores: { vulnerabilities: vulnScore, malware: malwareScore, intrusionAlerts: alertScore },
  };
}

export function riskLevelForScore(score: number): "Critical" | "High" | "Medium" | "Low" {
  if (score < 40) return "Critical";
  if (score < 60) return "High";
  if (score < 80) return "Medium";
  return "Low";
}

// Pulls open-finding counts by severity from each source module's own table - never a single
// merged/fake number, always kept as three labeled component counts (see overview.ts, which
// surfaces these per-source in the dashboard rather than silently combining them).
export async function getComponentCounts(): Promise<ComponentCounts> {
  const db = await getDb();

  const vulnResult = await db.query<{ Severity: string; Cnt: number }>(
    "SELECT Severity, COUNT(*) AS Cnt FROM VulnerabilityFindings WHERE Status IN ('Open','Confirmed') GROUP BY Severity"
  );
  const malwareResult = await db.query<{ Severity: string; Cnt: number }>(
    "SELECT Severity, COUNT(*) AS Cnt FROM MalwareFindings WHERE Status = 'Open' GROUP BY Severity"
  );
  const alertResult = await db.query<{ Severity: string; Cnt: number }>(
    "SELECT Severity, COUNT(*) AS Cnt FROM SecurityAlerts WHERE Status IN ('New','Investigating','Confirmed') GROUP BY Severity"
  );

  const toRecord = (rows: { Severity: string; Cnt: number }[]) => Object.fromEntries(rows.map((r) => [r.Severity, r.Cnt]));

  return {
    vulnerabilities: toRecord(vulnResult.recordset),
    malware: toRecord(malwareResult.recordset),
    intrusionAlerts: toRecord(alertResult.recordset),
  };
}
