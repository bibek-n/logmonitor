import { notFound } from "next/navigation";
import { getCqSession } from "@/lib/requireCodeQualityPermission";
import { getDb, sql } from "@/lib/db";
import { NotAuthorized } from "@/components/codeQuality/NotAuthorized";
import { ProjectFormClient } from "@/components/codeQuality/ProjectFormClient";

export const dynamic = "force-dynamic";

interface ProjectRow {
  Id: number;
  Name: string;
  Description: string | null;
  RepositoryUrl: string | null;
  SourcePath: string;
  DefaultBranch: string | null;
  Language: string | null;
  Status: "Active" | "Inactive";
  RepoConnectionId: number | null;
  RepoProvider: "GitHub" | "GitLab" | null;
  RepositoryOwner: string | null;
  RepositoryName: string | null;
  RepositoryRef: string | null;
}

export default async function EditCodeQualityProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const cq = await getCqSession("cq_project_update");
  if (!cq) return <NotAuthorized />;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, id)
    .query<ProjectRow>(
      "SELECT Id, Name, Description, RepositoryUrl, SourcePath, DefaultBranch, Language, Status, RepoConnectionId, RepoProvider, RepositoryOwner, RepositoryName, RepositoryRef FROM CodeQualityProjects WHERE Id = @id AND DeletedAt IS NULL"
    );
  const project = result.recordset[0];
  if (!project) notFound();

  return (
    <ProjectFormClient
      projectId={project.Id}
      initial={{
        name: project.Name,
        description: project.Description ?? "",
        repositoryUrl: project.RepositoryUrl ?? "",
        sourcePath: project.SourcePath,
        defaultBranch: project.DefaultBranch ?? "",
        language: project.Language ?? "",
        status: project.Status,
        repoConnectionId: project.RepoConnectionId,
        repoProvider: project.RepoProvider,
        repositoryOwner: project.RepositoryOwner ?? "",
        repositoryName: project.RepositoryName ?? "",
        repositoryRef: project.RepositoryRef ?? "",
      }}
    />
  );
}
