import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireCodeQualityPermission, isCqSession } from "@/lib/requireCodeQualityPermission";

// "Current" totals (quality score, files scanned, lines of code, duplication %) are computed
// from each active project's MOST RECENT completed scan, not summed across every scan ever
// run - otherwise re-scanning the same project repeatedly would inflate the numbers instead
// of reflecting current state.
export async function GET() {
  const cq = await requireCodeQualityPermission("cq_view");
  if (!isCqSession(cq)) return cq;

  const db = await getDb();

  const latestScans = await db.query`
    SELECT s.ProjectId, s.QualityScore, s.FilesScanned, s.LinesOfCode, s.Id AS ScanId
    FROM CodeQualityScans s
    INNER JOIN (
      SELECT ProjectId, MAX(CreatedAt) AS MaxCreatedAt
      FROM CodeQualityScans WHERE Status = 'Completed'
      GROUP BY ProjectId
    ) latest ON latest.ProjectId = s.ProjectId AND latest.MaxCreatedAt = s.CreatedAt
  `;

  const projectCount = await db.query`SELECT COUNT(*) AS Cnt FROM CodeQualityProjects WHERE DeletedAt IS NULL`;
  const scanCount = await db.query`SELECT COUNT(*) AS Cnt FROM CodeQualityScans`;

  const issueCounts = await db.query`
    SELECT Category, Severity, COUNT(*) AS Cnt
    FROM CodeQualityIssues WHERE Status IN ('Open', 'Confirmed')
    GROUP BY Category, Severity
  `;

  // Computed in JS rather than a parameterized SQL IN-list (mssql's tagged-template helper
  // doesn't support a dynamic-length array of parameters) - the metrics table is small enough
  // that fetching every DuplicationPercent row and filtering to this request's latest-scan-ids
  // in memory is simpler than hand-building a parameterized IN clause.
  const latestScanIds = latestScans.recordset.map((r: { ScanId: number }) => r.ScanId);
  const allDupMetrics = await db.query`SELECT ScanId, Value FROM CodeQualityMetrics WHERE MetricName = 'DuplicationPercent'`;
  const relevantDupMetrics = allDupMetrics.recordset.filter((m: { ScanId: number }) => latestScanIds.includes(m.ScanId));
  const duplicationPercentAvg =
    relevantDupMetrics.length > 0 ? relevantDupMetrics.reduce((sum: number, m: { Value: number }) => sum + m.Value, 0) / relevantDupMetrics.length : 0;

  const totals = {
    overallQualityScore:
      latestScans.recordset.length > 0
        ? Math.round(latestScans.recordset.reduce((sum: number, r: { QualityScore: number | null }) => sum + (r.QualityScore ?? 0), 0) / latestScans.recordset.length)
        : 0,
    totalProjects: projectCount.recordset[0].Cnt,
    totalScans: scanCount.recordset[0].Cnt,
    totalFilesScanned: latestScans.recordset.reduce((sum: number, r: { FilesScanned: number }) => sum + r.FilesScanned, 0),
    totalLinesOfCode: latestScans.recordset.reduce((sum: number, r: { LinesOfCode: number }) => sum + r.LinesOfCode, 0),
    totalOpenIssues: issueCounts.recordset.reduce((sum: number, r: { Cnt: number }) => sum + r.Cnt, 0),
    criticalIssues: issueCounts.recordset.filter((r: { Severity: string }) => r.Severity === "Critical").reduce((sum: number, r: { Cnt: number }) => sum + r.Cnt, 0),
    highSeverityIssues: issueCounts.recordset.filter((r: { Severity: string }) => r.Severity === "High").reduce((sum: number, r: { Cnt: number }) => sum + r.Cnt, 0),
    duplicationPercent: Math.round(duplicationPercentAvg * 100) / 100,
    deadCodeCount: issueCounts.recordset.filter((r: { Category: string }) => r.Category === "DeadCode").reduce((sum: number, r: { Cnt: number }) => sum + r.Cnt, 0),
    unusedVariablesCount: issueCounts.recordset.filter((r: { Category: string }) => r.Category === "UnusedVariable").reduce((sum: number, r: { Cnt: number }) => sum + r.Cnt, 0),
    unusedFunctionsCount: issueCounts.recordset.filter((r: { Category: string }) => r.Category === "UnusedFunction").reduce((sum: number, r: { Cnt: number }) => sum + r.Cnt, 0),
    codingStandardsViolationCount: issueCounts.recordset.filter((r: { Category: string }) => r.Category === "CodingStandard").reduce((sum: number, r: { Cnt: number }) => sum + r.Cnt, 0),
  };

  return NextResponse.json({ ok: true, data: totals });
}
