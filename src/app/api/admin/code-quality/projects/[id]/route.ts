import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireCodeQualityPermission, isCqSession } from "@/lib/requireCodeQualityPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { validateSourcePath } from "@/lib/pathSecurity";
import { upsertProjectSchema } from "@/lib/codeQualityShared";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cq = await requireCodeQualityPermission("cq_view");
  if (!isCqSession(cq)) return cq;

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) return NextResponse.json({ ok: false, error: "Invalid project id" }, { status: 400 });

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).query(`
    SELECT p.Id, p.Name, p.Description, p.RepositoryUrl, p.SourcePath, p.DefaultBranch, p.Language, p.ScanConfig, p.Status,
      p.RepoConnectionId, p.RepoProvider, p.RepositoryOwner, p.RepositoryName, p.RepositoryRef, p.LastSyncedCommitSha,
      CONVERT(VARCHAR(19), p.LastSyncedAt, 126) AS LastSyncedAt,
      rc.Name AS RepoConnectionName, rc.AuthMethod AS RepoConnectionAuthMethod, rc.InstanceUrl AS RepoConnectionInstanceUrl,
      CONVERT(VARCHAR(19), p.CreatedAt, 126) AS CreatedAt, CONVERT(VARCHAR(19), p.UpdatedAt, 126) AS UpdatedAt
    FROM CodeQualityProjects p
    LEFT JOIN RepoConnections rc ON rc.Id = p.RepoConnectionId
    WHERE p.Id = @id AND p.DeletedAt IS NULL
  `);
  const project = result.recordset[0];
  if (!project) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });

  const scanHistory = await db.request().input("projectId", sql.Int, id).query(`
    SELECT TOP 10 Id, Status, CONVERT(VARCHAR(19), StartedAt, 126) AS StartedAt,
      CONVERT(VARCHAR(19), CompletedAt, 126) AS CompletedAt, QualityScore, FilesScanned, LinesOfCode
    FROM CodeQualityScans WHERE ProjectId = @projectId ORDER BY CreatedAt DESC
  `);

  return NextResponse.json({ ok: true, data: { ...project, recentScans: scanHistory.recordset } });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cq = await requireCodeQualityPermission("cq_project_update");
  if (!isCqSession(cq)) return cq;

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) return NextResponse.json({ ok: false, error: "Invalid project id" }, { status: 400 });

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, id).query<{ Id: number }>("SELECT Id FROM CodeQualityProjects WHERE Id = @id AND DeletedAt IS NULL");
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = upsertProjectSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request body." }, { status: 400 });
  }
  const input = parsed.data;

  let resolvedSourcePath: string | undefined;
  if (input.sourcePath !== undefined) {
    const pathCheck = validateSourcePath(input.sourcePath);
    if (!pathCheck.ok) return NextResponse.json({ ok: false, error: pathCheck.error ?? "Invalid source path." }, { status: 400 });
    resolvedSourcePath = pathCheck.resolvedPath;
  }

  const setClauses: string[] = [];
  const request = db.request().input("id", sql.Int, id);

  if (input.name !== undefined) { setClauses.push("Name = @name"); request.input("name", sql.NVarChar, input.name); }
  if (input.description !== undefined) { setClauses.push("Description = @description"); request.input("description", sql.NVarChar, input.description); }
  if (input.repositoryUrl !== undefined) { setClauses.push("RepositoryUrl = @repositoryUrl"); request.input("repositoryUrl", sql.NVarChar, input.repositoryUrl); }
  if (resolvedSourcePath !== undefined) { setClauses.push("SourcePath = @sourcePath"); request.input("sourcePath", sql.NVarChar, resolvedSourcePath); }
  if (input.defaultBranch !== undefined) { setClauses.push("DefaultBranch = @defaultBranch"); request.input("defaultBranch", sql.NVarChar, input.defaultBranch); }
  if (input.language !== undefined) { setClauses.push("Language = @language"); request.input("language", sql.NVarChar, input.language); }
  if (input.scanConfig !== undefined) { setClauses.push("ScanConfig = @scanConfig"); request.input("scanConfig", sql.NVarChar, input.scanConfig ? JSON.stringify(input.scanConfig) : null); }
  if (input.status !== undefined) { setClauses.push("Status = @status"); request.input("status", sql.VarChar, input.status); }
  // Repointing a project at a different repo/connection doesn't resync immediately - the next
  // scan (see runScan.ts) syncs before it runs, so SourcePath naturally catches up rather than
  // duplicating the sync logic here for an edit that may not be scanned right away.
  if (input.repoConnectionId !== undefined) { setClauses.push("RepoConnectionId = @repoConnectionId"); request.input("repoConnectionId", sql.Int, input.repoConnectionId); }
  if (input.repoProvider !== undefined) { setClauses.push("RepoProvider = @repoProvider"); request.input("repoProvider", sql.VarChar, input.repoProvider); }
  if (input.repositoryOwner !== undefined) { setClauses.push("RepositoryOwner = @repositoryOwner"); request.input("repositoryOwner", sql.NVarChar, input.repositoryOwner); }
  if (input.repositoryName !== undefined) { setClauses.push("RepositoryName = @repositoryName"); request.input("repositoryName", sql.NVarChar, input.repositoryName); }
  if (input.repositoryRef !== undefined) { setClauses.push("RepositoryRef = @repositoryRef"); request.input("repositoryRef", sql.NVarChar, input.repositoryRef); }

  if (setClauses.length === 0) return NextResponse.json({ ok: false, error: "No fields to update." }, { status: 400 });

  setClauses.push("UpdatedAt = SYSUTCDATETIME()");
  await request.query(`UPDATE CodeQualityProjects SET ${setClauses.join(", ")} WHERE Id = @id`);

  await logAdminAction({ admin: cq, section: "code-quality", action: "update_project", details: `Project #${id}`, req });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cq = await requireCodeQualityPermission("cq_project_delete");
  if (!isCqSession(cq)) return cq;

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) return NextResponse.json({ ok: false, error: "Invalid project id" }, { status: 400 });

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, id).query<{ Id: number }>("SELECT Id FROM CodeQualityProjects WHERE Id = @id AND DeletedAt IS NULL");
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });

  await db.request().input("id", sql.Int, id).query("UPDATE CodeQualityProjects SET DeletedAt = SYSUTCDATETIME() WHERE Id = @id");
  await logAdminAction({ admin: cq, section: "code-quality", action: "delete_project", details: `Project #${id}`, req });

  return NextResponse.json({ ok: true });
}
