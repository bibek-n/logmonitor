import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireCodeQualityPermission, isCqSession } from "@/lib/requireCodeQualityPermission";

// Chart data for the Code Quality dashboard - all recharts-friendly arrays of plain objects.
// Optional `projectId` narrows every series to one project; omitted, everything is
// project-wide.
export async function GET(req: NextRequest) {
  const cq = await requireCodeQualityPermission("cq_view");
  if (!isCqSession(cq)) return cq;

  const projectId = req.nextUrl.searchParams.get("projectId");
  const db = await getDb();

  const scoreHistoryRequest = db.request();
  if (projectId) scoreHistoryRequest.input("projectId", sql.Int, Number(projectId));
  const scoreHistory = await scoreHistoryRequest.query(`
    SELECT TOP 30 CONVERT(VARCHAR(19), CompletedAt, 126) AS Date, QualityScore, Id AS ScanId
    FROM CodeQualityScans
    WHERE Status = 'Completed' AND QualityScore IS NOT NULL ${projectId ? "AND ProjectId = @projectId" : ""}
    ORDER BY CompletedAt DESC
  `);

  const severityRequest = db.request();
  if (projectId) severityRequest.input("projectId", sql.Int, Number(projectId));
  const issuesBySeverity = await severityRequest.query(`
    SELECT Severity, COUNT(*) AS Count FROM CodeQualityIssues
    WHERE Status IN ('Open', 'Confirmed') ${projectId ? "AND ProjectId = @projectId" : ""}
    GROUP BY Severity
  `);

  const categoryRequest = db.request();
  if (projectId) categoryRequest.input("projectId", sql.Int, Number(projectId));
  const issuesByCategory = await categoryRequest.query(`
    SELECT Category, COUNT(*) AS Count FROM CodeQualityIssues
    WHERE Status IN ('Open', 'Confirmed') ${projectId ? "AND ProjectId = @projectId" : ""}
    GROUP BY Category
  `);

  const filesRequest = db.request();
  if (projectId) filesRequest.input("projectId", sql.Int, Number(projectId));
  const problematicFiles = await filesRequest.query(`
    SELECT TOP 10 FilePath, COUNT(*) AS IssueCount,
      SUM(CASE WHEN Severity IN ('High', 'Critical') THEN 1 ELSE 0 END) AS HighOrCriticalCount
    FROM CodeQualityIssues
    WHERE Status IN ('Open', 'Confirmed') ${projectId ? "AND ProjectId = @projectId" : ""}
    GROUP BY FilePath
    ORDER BY COUNT(*) DESC
  `);

  const scanTrendRequest = db.request();
  if (projectId) scanTrendRequest.input("projectId", sql.Int, Number(projectId));
  const scanTrend = await scanTrendRequest.query(`
    SELECT TOP 30 CONVERT(VARCHAR(19), CreatedAt, 126) AS Date, Status, FilesScanned, LinesOfCode,
      (SELECT COUNT(*) FROM CodeQualityIssues i WHERE i.ScanId = s.Id) AS IssueCount
    FROM CodeQualityScans s
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
