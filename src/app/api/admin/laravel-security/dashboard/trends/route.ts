import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireLaravelSecurityPermission, isLsSession } from "@/lib/requireLaravelSecurityPermission";

// Chart data for the Laravel Security dashboard - recharts-friendly arrays of plain objects,
// same shape as codeQuality's dashboard/trends/route.ts. Optional `projectId` narrows every
// series to one project; omitted, everything is project-wide.
export async function GET(req: NextRequest) {
  const ls = await requireLaravelSecurityPermission("ls_view");
  if (!isLsSession(ls)) return ls;

  const projectId = req.nextUrl.searchParams.get("projectId");
  const db = await getDb();

  const scoreHistoryRequest = db.request();
  if (projectId) scoreHistoryRequest.input("projectId", sql.Int, Number(projectId));
  const scoreHistory = await scoreHistoryRequest.query(`
    SELECT TOP 30 CONVERT(VARCHAR(19), CompletedAt, 126) AS Date, SecurityScore, Id AS ScanId
    FROM LaravelSecurityScans
    WHERE Status = 'Completed' AND SecurityScore IS NOT NULL ${projectId ? "AND ProjectId = @projectId" : ""}
    ORDER BY CompletedAt DESC
  `);

  const severityRequest = db.request();
  if (projectId) severityRequest.input("projectId", sql.Int, Number(projectId));
  const issuesBySeverity = await severityRequest.query(`
    SELECT Severity, COUNT(*) AS Count FROM LaravelSecurityIssues
    WHERE Status IN ('Open', 'Confirmed') ${projectId ? "AND ProjectId = @projectId" : ""}
    GROUP BY Severity
  `);

  const categoryRequest = db.request();
  if (projectId) categoryRequest.input("projectId", sql.Int, Number(projectId));
  const issuesByCategory = await categoryRequest.query(`
    SELECT Category, COUNT(*) AS Count FROM LaravelSecurityIssues
    WHERE Status IN ('Open', 'Confirmed') ${projectId ? "AND ProjectId = @projectId" : ""}
    GROUP BY Category
  `);

  const filesRequest = db.request();
  if (projectId) filesRequest.input("projectId", sql.Int, Number(projectId));
  const problematicFiles = await filesRequest.query(`
    SELECT TOP 10 FilePath, COUNT(*) AS IssueCount,
      SUM(CASE WHEN Severity IN ('High', 'Critical') THEN 1 ELSE 0 END) AS HighOrCriticalCount
    FROM LaravelSecurityIssues
    WHERE Status IN ('Open', 'Confirmed') ${projectId ? "AND ProjectId = @projectId" : ""}
    GROUP BY FilePath
    ORDER BY COUNT(*) DESC
  `);

  const scanTrendRequest = db.request();
  if (projectId) scanTrendRequest.input("projectId", sql.Int, Number(projectId));
  const scanTrend = await scanTrendRequest.query(`
    SELECT TOP 30 CONVERT(VARCHAR(19), CreatedAt, 126) AS Date, Status, FilesScanned,
      (SELECT COUNT(*) FROM LaravelSecurityIssues i WHERE i.ScanId = s.Id) AS IssueCount
    FROM LaravelSecurityScans s
    WHERE 1 = 1 ${projectId ? "AND ProjectId = @projectId" : ""}
    ORDER BY CreatedAt DESC
  `);

  return NextResponse.json({
    ok: true,
    data: {
      scoreHistory: scoreHistory.recordset.reverse(),
      issuesBySeverity: issuesBySeverity.recordset,
      issuesByCategory: issuesByCategory.recordset,
      mostProblematicFiles: problematicFiles.recordset,
      scanTrend: scanTrend.recordset.reverse(),
    },
  });
}
