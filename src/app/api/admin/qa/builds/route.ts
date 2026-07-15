import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { VALID_BUILD_STATUSES, type QaBuildRow } from "@/lib/qaShared";

const MAX_BUILD_NUMBER_LENGTH = 100;

export async function GET(req: NextRequest) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const sp = req.nextUrl.searchParams;
  const projectId = Number(sp.get("projectId"));
  if (!Number.isInteger(projectId)) {
    return NextResponse.json({ ok: false, error: "A valid projectId is required." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.request().input("projectId", sql.Int, projectId).query<QaBuildRow>(`
    SELECT Id, ProjectId, ReleaseId, BuildNumber, GitCommit, Branch,
      CONVERT(VARCHAR(19), DeploymentDate, 126) AS DeploymentDate,
      EnvironmentId, Status, CreatedByUserId,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
    FROM QaBuilds WHERE ProjectId = @projectId ORDER BY CreatedAt DESC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const qa = await requireQaPermission("qa_create");
  if (!isQaSession(qa)) return qa;

  const body = await req.json().catch(() => null);
  const projectId = Number(body?.projectId);
  const releaseId = body?.releaseId != null ? Number(body.releaseId) : null;
  const buildNumber = typeof body?.buildNumber === "string" ? body.buildNumber.trim() : "";
  const gitCommit = typeof body?.gitCommit === "string" ? (body.gitCommit.trim() || null) : null;
  const branch = typeof body?.branch === "string" ? (body.branch.trim() || null) : null;
  const environmentId = body?.environmentId != null ? Number(body.environmentId) : null;
  const status = typeof body?.status === "string" && VALID_BUILD_STATUSES.has(body.status) ? body.status : "Pending";

  if (!Number.isInteger(projectId)) return NextResponse.json({ ok: false, error: "A valid projectId is required." }, { status: 400 });
  if (releaseId !== null && !Number.isInteger(releaseId)) return NextResponse.json({ ok: false, error: "Invalid releaseId." }, { status: 400 });
  if (environmentId !== null && !Number.isInteger(environmentId)) return NextResponse.json({ ok: false, error: "Invalid environmentId." }, { status: 400 });
  if (!buildNumber) return NextResponse.json({ ok: false, error: "Build number is required." }, { status: 400 });
  if (buildNumber.length > MAX_BUILD_NUMBER_LENGTH) return NextResponse.json({ ok: false, error: `Build number must be ${MAX_BUILD_NUMBER_LENGTH} characters or fewer.` }, { status: 400 });

  const db = await getDb();
  const projectCheck = await db.request().input("id", sql.Int, projectId).query<{ Id: number }>(
    "SELECT Id FROM QaProjects WHERE Id = @id"
  );
  if (!projectCheck.recordset[0]) {
    return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
  }

  const insertResult = await db.request()
    .input("projectId", sql.Int, projectId)
    .input("releaseId", sql.Int, releaseId)
    .input("buildNumber", sql.NVarChar, buildNumber)
    .input("gitCommit", sql.NVarChar, gitCommit)
    .input("branch", sql.NVarChar, branch)
    .input("environmentId", sql.Int, environmentId)
    .input("status", sql.VarChar, status)
    .input("createdByUserId", sql.Int, qa.userId)
    .query<QaBuildRow>(`
      INSERT INTO QaBuilds (ProjectId, ReleaseId, BuildNumber, GitCommit, Branch, DeploymentDate, EnvironmentId, Status, CreatedByUserId)
      OUTPUT INSERTED.Id, INSERTED.ProjectId, INSERTED.ReleaseId, INSERTED.BuildNumber, INSERTED.GitCommit,
        INSERTED.Branch, CONVERT(VARCHAR(19), INSERTED.DeploymentDate, 126) AS DeploymentDate,
        INSERTED.EnvironmentId, INSERTED.Status, INSERTED.CreatedByUserId,
        CONVERT(VARCHAR(19), INSERTED.CreatedAt, 126) AS CreatedAt
      VALUES (@projectId, @releaseId, @buildNumber, @gitCommit, @branch, SYSUTCDATETIME(), @environmentId, @status, @createdByUserId)
    `);
  const build = insertResult.recordset[0];

  await logAdminAction({ admin: qa, section: "qa", action: "create_build", details: build.BuildNumber, req });
  await logQaActivity({ entityType: "Build", entityId: build.Id, action: "create", userId: qa.userId, newValue: build, req });

  return NextResponse.json({ ok: true, data: build });
}
