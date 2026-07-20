import { notFound } from "next/navigation";
import { getLsAccess } from "@/lib/requireLaravelSecurityPermission";
import { getDb, sql } from "@/lib/db";
import { NotAuthorized } from "@/components/shared/NotAuthorized";
import { ScanDetailClient } from "@/components/laravelSecurity/ScanDetailClient";

export const dynamic = "force-dynamic";

export default async function LaravelSecurityScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { ls, can } = await getLsAccess();
  if (!ls) return <NotAuthorized moduleName="Laravel Security" />;

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
      s.DurationMs, s.FilesScanned, s.SecurityScore, s.ErrorMessage
    FROM LaravelSecurityScans s
    JOIN LaravelSecurityProjects p ON p.Id = s.ProjectId
    LEFT JOIN Users u ON u.Id = s.StartedByUserId
    WHERE s.Id = @id
  `);
  const scan = scanResult.recordset[0];
  if (!scan) notFound();

  const issueCounts = await db.request().input("id", sql.Int, id).query(`
    SELECT Category, COUNT(*) AS Cnt FROM LaravelSecurityIssues WHERE ScanId = @id GROUP BY Category
  `);

  return <ScanDetailClient scan={scan} issueCounts={issueCounts.recordset} can={can} />;
}
