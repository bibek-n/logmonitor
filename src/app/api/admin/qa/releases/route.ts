import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { VALID_RELEASE_STATUSES, type QaReleaseRow } from "@/lib/qaShared";

const MAX_NAME_LENGTH = 100;

export async function GET(req: NextRequest) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const projectIdParam = req.nextUrl.searchParams.get("projectId");
  const db = await getDb();
  const request = db.request();

  let where = "";
  if (projectIdParam) {
    const projectId = Number(projectIdParam);
    if (!Number.isInteger(projectId)) {
      return NextResponse.json({ ok: false, error: "Invalid projectId." }, { status: 400 });
    }
    request.input("projectId", sql.Int, projectId);
    where = "WHERE ProjectId = @projectId";
  }

  const result = await request.query<QaReleaseRow>(`
    SELECT Id, ProjectId, Name, CONVERT(VARCHAR(10), ReleaseDate, 126) AS ReleaseDate, Status,
      ReleasedByUserId, CONVERT(VARCHAR(19), ReleasedAt, 126) AS ReleasedAt,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
    FROM QaReleases ${where}
    ORDER BY ReleaseDate DESC, Name ASC
  `);
  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const qa = await requireQaPermission("qa_create");
  if (!isQaSession(qa)) return qa;

  const body = await req.json().catch(() => null);
  const projectId = Number(body?.projectId);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const releaseDate = typeof body?.releaseDate === "string" && body.releaseDate.trim() ? body.releaseDate.trim() : null;
  const status = typeof body?.status === "string" && VALID_RELEASE_STATUSES.has(body.status) ? body.status : "Planned";

  if (!Number.isInteger(projectId)) {
    return NextResponse.json({ ok: false, error: "A valid projectId is required." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ ok: false, error: "Release name is required." }, { status: 400 });
  }
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ ok: false, error: `Release name must be ${MAX_NAME_LENGTH} characters or fewer.` }, { status: 400 });
  }

  const db = await getDb();

  const projectCheck = await db.request().input("id", sql.Int, projectId).query<{ Id: number }>(
    "SELECT Id FROM QaProjects WHERE Id = @id"
  );
  if (!projectCheck.recordset[0]) {
    return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
  }

  const result = await db
    .request()
    .input("projectId", sql.Int, projectId)
    .input("name", sql.NVarChar, name)
    .input("releaseDate", sql.Date, releaseDate)
    .input("status", sql.VarChar, status)
    .query<QaReleaseRow>(`
      INSERT INTO QaReleases (ProjectId, Name, ReleaseDate, Status)
      OUTPUT INSERTED.Id, INSERTED.ProjectId, INSERTED.Name,
        CONVERT(VARCHAR(10), INSERTED.ReleaseDate, 126) AS ReleaseDate, INSERTED.Status,
        INSERTED.ReleasedByUserId, CONVERT(VARCHAR(19), INSERTED.ReleasedAt, 126) AS ReleasedAt,
        CONVERT(VARCHAR(19), INSERTED.CreatedAt, 126) AS CreatedAt
      VALUES (@projectId, @name, @releaseDate, @status)
    `);
  const release = result.recordset[0];

  await logAdminAction({ admin: qa, section: "qa", action: "create_release", details: name, req });
  await logQaActivity({ entityType: "Release", entityId: release.Id, action: "create", userId: qa.userId, newValue: release, req });

  return NextResponse.json({ ok: true, data: release });
}
