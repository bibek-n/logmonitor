import { notFound } from "next/navigation";
import { getLsSession } from "@/lib/requireLaravelSecurityPermission";
import { getDb, sql } from "@/lib/db";
import { NotAuthorized } from "@/components/shared/NotAuthorized";
import { ProjectFormClient } from "@/components/laravelSecurity/ProjectFormClient";

export const dynamic = "force-dynamic";

interface ProjectRow {
  Id: number;
  Name: string;
  Description: string | null;
  RepositoryUrl: string | null;
  SourcePath: string;
  DefaultBranch: string | null;
  Status: "Active" | "Inactive";
  RepoConnectionId: number | null;
  RepoProvider: "GitHub" | "GitLab" | null;
  RepositoryOwner: string | null;
  RepositoryName: string | null;
  RepositoryRef: string | null;
}

export default async function EditLaravelSecurityProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const ls = await getLsSession("ls_project_update");
  if (!ls) return <NotAuthorized moduleName="Laravel Security" />;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, id)
    .query<ProjectRow>(
      "SELECT Id, Name, Description, RepositoryUrl, SourcePath, DefaultBranch, Status, RepoConnectionId, RepoProvider, RepositoryOwner, RepositoryName, RepositoryRef FROM LaravelSecurityProjects WHERE Id = @id AND DeletedAt IS NULL"
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
