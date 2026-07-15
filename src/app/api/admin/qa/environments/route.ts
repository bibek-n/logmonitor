import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { type QaEnvironmentRow } from "@/lib/qaShared";

const MAX_NAME_LENGTH = 100;

// Simple project-scoped lookup CRUD, no pagination — an environment list per project is
// small (DEV/QA/UAT/STAGING/PRODUCTION-ish), same weight as how Releases' list is handled.
// Only descriptive fields are stored: this is a public repo, so ApiUrl/DatabaseInfo/
// ConfigNotes must never hold real credentials, just human-readable references.
export async function GET(req: NextRequest) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const sp = req.nextUrl.searchParams;
  const projectId = Number(sp.get("projectId"));
  if (!Number.isInteger(projectId)) {
    return NextResponse.json({ ok: false, error: "A valid projectId is required." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.request().input("projectId", sql.Int, projectId).query<QaEnvironmentRow>(`
    SELECT Id, ProjectId, Name, ApiUrl, DatabaseInfo, BuildVersion, ConfigNotes, IsActive,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM QaEnvironments WHERE ProjectId = @projectId ORDER BY Name ASC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const qa = await requireQaPermission("qa_create");
  if (!isQaSession(qa)) return qa;

  const body = await req.json().catch(() => null);
  const projectId = Number(body?.projectId);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const apiUrl = typeof body?.apiUrl === "string" ? (body.apiUrl.trim() || null) : null;
  const databaseInfo = typeof body?.databaseInfo === "string" ? (body.databaseInfo.trim() || null) : null;
  const buildVersion = typeof body?.buildVersion === "string" ? (body.buildVersion.trim() || null) : null;
  const configNotes = typeof body?.configNotes === "string" ? (body.configNotes.trim() || null) : null;

  if (!Number.isInteger(projectId)) return NextResponse.json({ ok: false, error: "A valid projectId is required." }, { status: 400 });
  if (!name) return NextResponse.json({ ok: false, error: "Environment name is required." }, { status: 400 });
  if (name.length > MAX_NAME_LENGTH) return NextResponse.json({ ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` }, { status: 400 });

  const db = await getDb();
  const projectCheck = await db.request().input("id", sql.Int, projectId).query<{ Id: number }>(
    "SELECT Id FROM QaProjects WHERE Id = @id"
  );
  if (!projectCheck.recordset[0]) {
    return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
  }

  const insertResult = await db.request()
    .input("projectId", sql.Int, projectId)
    .input("name", sql.NVarChar, name)
    .input("apiUrl", sql.NVarChar, apiUrl)
    .input("databaseInfo", sql.NVarChar, databaseInfo)
    .input("buildVersion", sql.NVarChar, buildVersion)
    .input("configNotes", sql.NVarChar, configNotes)
    .query<QaEnvironmentRow>(`
      INSERT INTO QaEnvironments (ProjectId, Name, ApiUrl, DatabaseInfo, BuildVersion, ConfigNotes)
      OUTPUT INSERTED.Id, INSERTED.ProjectId, INSERTED.Name, INSERTED.ApiUrl, INSERTED.DatabaseInfo,
        INSERTED.BuildVersion, INSERTED.ConfigNotes, INSERTED.IsActive,
        CONVERT(VARCHAR(19), INSERTED.CreatedAt, 126) AS CreatedAt,
        CONVERT(VARCHAR(19), INSERTED.UpdatedAt, 126) AS UpdatedAt
      VALUES (@projectId, @name, @apiUrl, @databaseInfo, @buildVersion, @configNotes)
    `);
  const environment = insertResult.recordset[0];

  await logAdminAction({ admin: qa, section: "qa", action: "create_environment", details: environment.Name, req });
  await logQaActivity({ entityType: "Environment", entityId: environment.Id, action: "create", userId: qa.userId, newValue: environment, req });

  return NextResponse.json({ ok: true, data: environment });
}
