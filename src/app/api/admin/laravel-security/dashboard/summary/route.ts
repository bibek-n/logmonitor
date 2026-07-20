import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireLaravelSecurityPermission, isLsSession } from "@/lib/requireLaravelSecurityPermission";

// "Current" totals (security score, files scanned) are computed from each active project's
// MOST RECENT completed scan, not summed across every scan ever run - same reasoning as
// codeQuality's dashboard/summary/route.ts.
export async function GET() {
  const ls = await requireLaravelSecurityPermission("ls_view");
  if (!isLsSession(ls)) return ls;

  const db = await getDb();

  const latestScans = await db.query`
    SELECT s.ProjectId, s.SecurityScore, s.FilesScanned, s.Id AS ScanId
    FROM LaravelSecurityScans s
    INNER JOIN (
      SELECT ProjectId, MAX(CreatedAt) AS MaxCreatedAt
      FROM LaravelSecurityScans WHERE Status = 'Completed'
      GROUP BY ProjectId
    ) latest ON latest.ProjectId = s.ProjectId AND latest.MaxCreatedAt = s.CreatedAt
  `;

  const projectCount = await db.query`SELECT COUNT(*) AS Cnt FROM LaravelSecurityProjects WHERE DeletedAt IS NULL`;
  const scanCount = await db.query`SELECT COUNT(*) AS Cnt FROM LaravelSecurityScans`;

  const issueCounts = await db.query`
    SELECT Category, Severity, COUNT(*) AS Cnt
    FROM LaravelSecurityIssues WHERE Status IN ('Open', 'Confirmed')
    GROUP BY Category, Severity
  `;

  const totals = {
    overallSecurityScore:
      latestScans.recordset.length > 0
        ? Math.round(latestScans.recordset.reduce((sum: number, r: { SecurityScore: number | null }) => sum + (r.SecurityScore ?? 0), 0) / latestScans.recordset.length)
        : 0,
    totalProjects: projectCount.recordset[0].Cnt,
    totalScans: scanCount.recordset[0].Cnt,
    totalFilesScanned: latestScans.recordset.reduce((sum: number, r: { FilesScanned: number }) => sum + r.FilesScanned, 0),
    totalOpenIssues: issueCounts.recordset.reduce((sum: number, r: { Cnt: number }) => sum + r.Cnt, 0),
    criticalIssues: issueCounts.recordset.filter((r: { Severity: string }) => r.Severity === "Critical").reduce((sum: number, r: { Cnt: number }) => sum + r.Cnt, 0),
    highSeverityIssues: issueCounts.recordset.filter((r: { Severity: string }) => r.Severity === "High").reduce((sum: number, r: { Cnt: number }) => sum + r.Cnt, 0),
    appDebugCount: issueCounts.recordset.filter((r: { Category: string }) => r.Category === "AppDebug").reduce((sum: number, r: { Cnt: number }) => sum + r.Cnt, 0),
    appKeyCount: issueCounts.recordset.filter((r: { Category: string }) => r.Category === "AppKey").reduce((sum: number, r: { Cnt: number }) => sum + r.Cnt, 0),
    dotEnvCount: issueCounts.recordset.filter((r: { Category: string }) => r.Category === "DotEnv").reduce((sum: number, r: { Cnt: number }) => sum + r.Cnt, 0),
    csrfCount: issueCounts.recordset.filter((r: { Category: string }) => r.Category === "Csrf").reduce((sum: number, r: { Cnt: number }) => sum + r.Cnt, 0),
    massAssignmentCount: issueCounts.recordset.filter((r: { Category: string }) => r.Category === "MassAssignment").reduce((sum: number, r: { Cnt: number }) => sum + r.Cnt, 0),
    validationCount: issueCounts.recordset.filter((r: { Category: string }) => r.Category === "Validation").reduce((sum: number, r: { Cnt: number }) => sum + r.Cnt, 0),
    sanitizationCount: issueCounts.recordset.filter((r: { Category: string }) => r.Category === "Sanitization").reduce((sum: number, r: { Cnt: number }) => sum + r.Cnt, 0),
    storageLinksCount: issueCounts.recordset.filter((r: { Category: string }) => r.Category === "StorageLinks").reduce((sum: number, r: { Cnt: number }) => sum + r.Cnt, 0),
    queueCount: issueCounts.recordset.filter((r: { Category: string }) => r.Category === "Queue").reduce((sum: number, r: { Cnt: number }) => sum + r.Cnt, 0),
  };

  return NextResponse.json({ ok: true, data: totals });
}
