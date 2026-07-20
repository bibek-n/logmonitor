import { notFound } from "next/navigation";
import { getCqAccess } from "@/lib/requireCodeQualityPermission";
import { getDb, sql } from "@/lib/db";
import { NotAuthorized } from "@/components/codeQuality/NotAuthorized";
import { ProjectDetailClient } from "@/components/codeQuality/ProjectDetailClient";

export const dynamic = "force-dynamic";

interface ProjectRow {
  Id: number;
  Name: string;
  Description: string | null;
  RepositoryUrl: string | null;
  SourcePath: string;
  DefaultBranch: string | null;
  Language: string | null;
  Status: string;
  CreatedAt: string;
}

interface ScanRow {
  Id: number;
  Status: string;
  StartedAt: string | null;
  CompletedAt: string | null;
  QualityScore: number | null;
  FilesScanned: number;
  LinesOfCode: number;
}

export default async function CodeQualityProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { cq, can } = await getCqAccess();
  if (!cq) return <NotAuthorized />;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const db = await getDb();
  const projectResult = await db.request().input("id", sql.Int, id).query<ProjectRow>(`
    SELECT Id, Name, Description, RepositoryUrl, SourcePath, DefaultBranch, Language, Status,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
    FROM CodeQualityProjects WHERE Id = @id AND DeletedAt IS NULL
  `);
  const project = projectResult.recordset[0];
  if (!project) notFound();

  const scansResult = await db.request().input("id", sql.Int, id).query<ScanRow>(`
    SELECT TOP 10 Id, Status, CONVERT(VARCHAR(19), StartedAt, 126) AS StartedAt,
      CONVERT(VARCHAR(19), CompletedAt, 126) AS CompletedAt, QualityScore, FilesScanned, LinesOfCode
    FROM CodeQualityScans WHERE ProjectId = @id ORDER BY CreatedAt DESC
  `);

  return <ProjectDetailClient project={project} recentScans={scansResult.recordset} can={can} />;
}
