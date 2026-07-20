import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import type { QaTestSuiteRow } from "@/lib/qaShared";

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 1000;
const VALID_STATUSES = new Set(["Active", "Archived"]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const suiteId = Number(id);
  if (!Number.isInteger(suiteId)) {
    return NextResponse.json({ ok: false, error: "Invalid test suite id." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, suiteId).query<QaTestSuiteRow>(`
    SELECT Id, ProjectId, ModuleId, Name, Description, RequirementRef, Status, CreatedByUserId, UpdatedByUserId,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM QaTestSuites WHERE Id = @id
  `);
  const suite = result.recordset[0];
  if (!suite) {
    return NextResponse.json({ ok: false, error: "Test suite not found." }, { status: 404 });
  }

  const caseCountResult = await db.request().input("suiteId", sql.Int, suiteId).query<{ Cnt: number }>(
    "SELECT COUNT(*) AS Cnt FROM QaTestCases WHERE TestSuiteId = @suiteId"
  );

  return NextResponse.json({ ok: true, data: { ...suite, TestCaseCount: caseCountResult.recordset[0]?.Cnt ?? 0 } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_edit");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const suiteId = Number(id);
  if (!Number.isInteger(suiteId)) {
    return NextResponse.json({ ok: false, error: "Invalid test suite id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const db = await getDb();

  const existingResult = await db.request().input("id", sql.Int, suiteId).query<QaTestSuiteRow>(
    "SELECT Id, ProjectId, ModuleId, Name, Description, RequirementRef, Status FROM QaTestSuites WHERE Id = @id"
  );
  const existing = existingResult.recordset[0];
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Test suite not found." }, { status: 404 });
  }

  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : existing.Name;
  const description = typeof body?.description === "string" ? (body.description.trim() || null) : existing.Description;
  const requirementRef = body?.requirementRef !== undefined ? (typeof body.requirementRef === "string" ? body.requirementRef.trim().slice(0, 200) || null : null) : existing.RequirementRef;
  const moduleId = body?.moduleId !== undefined ? (body.moduleId === null ? null : Number(body.moduleId)) : existing.ModuleId;
  const status = typeof body?.status === "string" && VALID_STATUSES.has(body.status) ? body.status : existing.Status;

  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` }, { status: 400 });
  }
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json({ ok: false, error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.` }, { status: 400 });
  }
  if (moduleId !== null && !Number.isInteger(moduleId)) {
    return NextResponse.json({ ok: false, error: "Invalid moduleId." }, { status: 400 });
  }

  await db
    .request()
    .input("id", sql.Int, suiteId)
    .input("name", sql.NVarChar, name)
    .input("description", sql.NVarChar, description)
    .input("requirementRef", sql.NVarChar, requirementRef)
    .input("moduleId", sql.Int, moduleId)
    .input("status", sql.VarChar, status)
    .input("updatedByUserId", sql.Int, qa.userId)
    .query(`
      UPDATE QaTestSuites SET
        Name = @name, Description = @description, RequirementRef = @requirementRef, ModuleId = @moduleId, Status = @status,
        UpdatedByUserId = @updatedByUserId, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `);

  await logAdminAction({ admin: qa, section: "qa", action: "update_test_suite", details: name, req });
  await logQaActivity({
    entityType: "TestSuite", entityId: suiteId, action: "update", userId: qa.userId,
    previousValue: existing, newValue: { Name: name, Description: description, ModuleId: moduleId, Status: status }, req,
  });

  return NextResponse.json({ ok: true });
}

// Archive, not hard-delete — QaTestCases.TestSuiteId is NOT NULL, so a real DELETE would
// either fail on the FK or require cascading test-case deletion neither this app's
// conventions (no ON DELETE CASCADE anywhere) nor the spec's "view execution history"
// requirement would want. Matches the spec's explicit "Delete or archive a test suite".
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_delete");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const suiteId = Number(id);
  if (!Number.isInteger(suiteId)) {
    return NextResponse.json({ ok: false, error: "Invalid test suite id." }, { status: 400 });
  }

  const db = await getDb();
  const existingResult = await db.request().input("id", sql.Int, suiteId).query<{ Name: string; Status: string }>(
    "SELECT Name, Status FROM QaTestSuites WHERE Id = @id"
  );
  const existing = existingResult.recordset[0];
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Test suite not found." }, { status: 404 });
  }

  await db
    .request()
    .input("id", sql.Int, suiteId)
    .input("updatedByUserId", sql.Int, qa.userId)
    .query("UPDATE QaTestSuites SET Status = 'Archived', UpdatedByUserId = @updatedByUserId, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");

  await logAdminAction({ admin: qa, section: "qa", action: "archive_test_suite", details: existing.Name, req });
  await logQaActivity({
    entityType: "TestSuite", entityId: suiteId, action: "archive", userId: qa.userId,
    previousValue: { Status: existing.Status }, newValue: { Status: "Archived" }, req,
  });

  return NextResponse.json({ ok: true });
}
