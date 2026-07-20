import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireCodeQualityPermission, isCqSession } from "@/lib/requireCodeQualityPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { validateSourcePath } from "@/lib/pathSecurity";
import { createProjectSchema, parsePagination } from "@/lib/codeQualityShared";
import { syncRepo } from "@/lib/repoConnections/sync";
import type { RepoConnectionRow } from "@/lib/repoConnections/types";

const SORT_COLUMNS = new Set(["Name", "Language", "Status", "CreatedAt", "UpdatedAt"]);

export async function GET(req: NextRequest) {
  const cq = await requireCodeQualityPermission("cq_view");
  if (!isCqSession(cq)) return cq;

  const sp = req.nextUrl.searchParams;
  const { page, pageSize, offset } = parsePagination(sp);
  const search = sp.get("search")?.trim();
  const status = sp.get("status");
  const language = sp.get("language");
  const sortByParam = sp.get("sortBy") ?? "CreatedAt";
  const sortColumn = SORT_COLUMNS.has(sortByParam) ? sortByParam : "CreatedAt";
  const sortDir = sp.get("sortDir") === "asc" ? "ASC" : "DESC";

  const conditions: string[] = ["p.DeletedAt IS NULL"];
  const db = await getDb();
  const countRequest = db.request();
  const listRequest = db.request();

  if (search) {
    conditions.push("(p.Name LIKE @search OR p.SourcePath LIKE @search)");
    countRequest.input("search", sql.NVarChar, `%${search}%`);
    listRequest.input("search", sql.NVarChar, `%${search}%`);
  }
  if (status) {
    conditions.push("p.Status = @status");
    countRequest.input("status", sql.VarChar, status);
    listRequest.input("status", sql.VarChar, status);
  }
  if (language) {
    conditions.push("p.Language = @language");
    countRequest.input("language", sql.NVarChar, language);
    listRequest.input("language", sql.NVarChar, language);
  }
  const whereClause = conditions.join(" AND ");

  const countResult = await countRequest.query<{ Total: number }>(`SELECT COUNT(*) AS Total FROM CodeQualityProjects p WHERE ${whereClause}`);
  const total = countResult.recordset[0].Total;

  const listResult = await listRequest.input("offset", sql.Int, offset).input("pageSize", sql.Int, pageSize).query(`
    SELECT
      p.Id, p.Name, p.Description, p.RepositoryUrl, p.SourcePath, p.DefaultBranch, p.Language, p.Status,
      CONVERT(VARCHAR(19), p.CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), p.UpdatedAt, 126) AS UpdatedAt,
      latest.Status AS LastScanStatus,
      CONVERT(VARCHAR(19), latest.CompletedAt, 126) AS LastScanDate,
      latest.QualityScore AS QualityScore,
      (SELECT COUNT(*) FROM CodeQualityIssues i WHERE i.ProjectId = p.Id AND i.Status IN ('Open', 'Confirmed')) AS TotalIssues
    FROM CodeQualityProjects p
    OUTER APPLY (
      SELECT TOP 1 s.Status, s.CompletedAt, s.QualityScore
      FROM CodeQualityScans s
      WHERE s.ProjectId = p.Id
      ORDER BY s.CreatedAt DESC
    ) latest
    WHERE ${whereClause}
    ORDER BY p.${sortColumn} ${sortDir}
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  return NextResponse.json({
    ok: true,
    data: listResult.recordset,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}

export async function POST(req: NextRequest) {
  const cq = await requireCodeQualityPermission("cq_project_create");
  if (!isCqSession(cq)) return cq;

  const body = await req.json().catch(() => null);
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request body." }, { status: 400 });
  }
  const input = parsed.data;
  const db = await getDb();

  let resolvedSourcePath: string;
  let commitSha: string | null = null;

  if (input.repoConnectionId && input.repoProvider && input.repositoryOwner && input.repositoryName) {
    const connectionResult = await db
      .request()
      .input("id", sql.Int, input.repoConnectionId)
      .query<{ Id: number; Provider: "GitHub" | "GitLab"; AuthMethod: "PAT" | "OAuthApp" | "GitHubApp"; InstanceUrl: string | null; AccessTokenEncrypted: string | null; InstallationId: number | null }>(
        "SELECT Id, Provider, AuthMethod, InstanceUrl, AccessTokenEncrypted, InstallationId FROM RepoConnections WHERE Id = @id AND DeletedAt IS NULL"
      );
    const row = connectionResult.recordset[0];
    if (!row) return NextResponse.json({ ok: false, error: "Repository connection not found." }, { status: 400 });

    const connection: RepoConnectionRow = { id: row.Id, provider: row.Provider, authMethod: row.AuthMethod, instanceUrl: row.InstanceUrl, accessTokenEncrypted: row.AccessTokenEncrypted, installationId: row.InstallationId };

    try {
      const synced = await syncRepo({ connection, owner: input.repositoryOwner, repo: input.repositoryName, ref: input.repositoryRef ?? input.defaultBranch ?? "HEAD" });
      resolvedSourcePath = synced.localPath;
      commitSha = synced.commitSha;
    } catch (err) {
      return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : `Failed to sync repository from ${row.Provider}.` }, { status: 400 });
    }
  } else {
    const pathCheck = validateSourcePath(input.sourcePath!);
    if (!pathCheck.ok) {
      return NextResponse.json({ ok: false, error: pathCheck.error ?? "Invalid source path." }, { status: 400 });
    }
    resolvedSourcePath = pathCheck.resolvedPath;
  }

  const insertResult = await db
    .request()
    .input("name", sql.NVarChar, input.name)
    .input("description", sql.NVarChar, input.description ?? null)
    .input("repositoryUrl", sql.NVarChar, input.repositoryUrl ?? null)
    .input("sourcePath", sql.NVarChar, resolvedSourcePath)
    .input("defaultBranch", sql.NVarChar, input.defaultBranch ?? null)
    .input("language", sql.NVarChar, input.language ?? null)
    .input("scanConfig", sql.NVarChar, input.scanConfig ? JSON.stringify(input.scanConfig) : null)
    .input("status", sql.VarChar, input.status ?? "Active")
    .input("createdByUserId", sql.Int, cq.userId)
    .input("repoConnectionId", sql.Int, input.repoConnectionId ?? null)
    .input("repoProvider", sql.VarChar, input.repoProvider ?? null)
    .input("repositoryOwner", sql.NVarChar, input.repositoryOwner ?? null)
    .input("repositoryName", sql.NVarChar, input.repositoryName ?? null)
    .input("repositoryRef", sql.NVarChar, input.repositoryRef ?? null)
    .input("commitSha", sql.NVarChar, commitSha)
    .query<{ Id: number }>(`
      INSERT INTO CodeQualityProjects
        (Name, Description, RepositoryUrl, SourcePath, DefaultBranch, Language, ScanConfig, Status, CreatedByUserId,
         RepoConnectionId, RepoProvider, RepositoryOwner, RepositoryName, RepositoryRef, LastSyncedCommitSha, LastSyncedAt)
      OUTPUT INSERTED.Id
      VALUES (@name, @description, @repositoryUrl, @sourcePath, @defaultBranch, @language, @scanConfig, @status, @createdByUserId,
              @repoConnectionId, @repoProvider, @repositoryOwner, @repositoryName, @repositoryRef, @commitSha,
              CASE WHEN @commitSha IS NULL THEN NULL ELSE SYSUTCDATETIME() END)
    `);

  const projectId = insertResult.recordset[0].Id;
  await logAdminAction({ admin: cq, section: "code-quality", action: "create_project", details: input.name, req });

  return NextResponse.json({ ok: true, data: { id: projectId } }, { status: 201 });
}
