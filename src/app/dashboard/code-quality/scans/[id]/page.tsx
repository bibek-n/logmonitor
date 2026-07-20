import { notFound } from "next/navigation";
import { getCqAccess } from "@/lib/requireCodeQualityPermission";
import { getDb, sql } from "@/lib/db";
import { NotAuthorized } from "@/components/codeQuality/NotAuthorized";
import { ScanDetailClient } from "@/components/codeQuality/ScanDetailClient";

export const dynamic = "force-dynamic";

export default async function CodeQualityScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { cq, can } = await getCqAccess();
  if (!cq) return <NotAuthorized />;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const db = await getDb();
  const scanResult = await db.request().input("id", sql.Int, id).query(`
    SELECT
      s.Id, s.ProjectId, p.Name AS ProjectName, s.Branch, s.ScanType, s.Status,
      u.Username AS StartedByUsername,
      CONVERT(VARCHAR(19), s.StartedAt, 126) AS StartedAt,
      CONVERT(VARCHAR(19), s.CompletedAt, 126) AS CompletedAt,
      s.DurationMs, s.FilesScanned, s.LinesOfCode, s.QualityScore, s.ErrorMessage
    FROM CodeQualityScans s
    JOIN CodeQualityProjects p ON p.Id = s.ProjectId
    LEFT JOIN Users u ON u.Id = s.StartedByUserId
    WHERE s.Id = @id
  `);
  const scan = scanResult.recordset[0];
  if (!scan) notFound();

  const issueCounts = await db.request().input("id", sql.Int, id).query(`
    SELECT Category, COUNT(*) AS Cnt FROM CodeQualityIssues WHERE ScanId = @id GROUP BY Category
  `);

  return <ScanDetailClient scan={scan} issueCounts={issueCounts.recordset} can={can} />;
}
