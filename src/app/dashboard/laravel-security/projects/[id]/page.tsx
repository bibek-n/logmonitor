import { notFound } from "next/navigation";
import { getLsAccess } from "@/lib/requireLaravelSecurityPermission";
import { getDb, sql } from "@/lib/db";
import { NotAuthorized } from "@/components/shared/NotAuthorized";
import { ProjectDetailClient } from "@/components/laravelSecurity/ProjectDetailClient";

export const dynamic = "force-dynamic";

interface ProjectRow {
  Id: number;
  Name: string;
  Description: string | null;
  RepositoryUrl: string | null;
  SourcePath: string;
  DefaultBranch: string | null;
  LaravelVersion: string | null;
  Status: string;
  CreatedAt: string;
}

interface ScanRow {
  Id: number;
  Status: string;
  StartedAt: string | null;
  CompletedAt: string | null;
  SecurityScore: number | null;
  FilesScanned: number;
}

export default async function LaravelSecurityProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { ls, can } = await getLsAccess();
  if (!ls) return <NotAuthorized moduleName="Laravel Security" />;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const db = await getDb();
  const projectResult = await db.request().input("id", sql.Int, id).query<ProjectRow>(`
    SELECT Id, Name, Description, RepositoryUrl, SourcePath, DefaultBranch, LaravelVersion, Status,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
    FROM LaravelSecurityProjects WHERE Id = @id AND DeletedAt IS NULL
  `);
  const project = projectResult.recordset[0];
  if (!project) notFound();

  const scansResult = await db.request().input("id", sql.Int, id).query<ScanRow>(`
    SELECT TOP 10 Id, Status, CONVERT(VARCHAR(19), StartedAt, 126) AS StartedAt,
      CONVERT(VARCHAR(19), CompletedAt, 126) AS CompletedAt, SecurityScore, FilesScanned
    FROM LaravelSecurityScans WHERE ProjectId = @id ORDER BY CreatedAt DESC
  `);

  return <ProjectDetailClient project={project} recentScans={scansResult.recordset} can={can} />;
}
