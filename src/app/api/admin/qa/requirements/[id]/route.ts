import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { VALID_PRIORITIES, VALID_REQUIREMENT_STATUSES, type QaRequirementRow } from "@/lib/qaShared";

const MAX_TITLE_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 4000;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const requirementId = Number(id);
  if (!Number.isInteger(requirementId)) {
    return NextResponse.json({ ok: false, error: "Invalid requirement id." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, requirementId).query<QaRequirementRow>(`
    SELECT Id, RequirementNumber, ProjectId, Title, Description, Category, Priority, Status,
      CreatedByUserId,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM QaRequirements WHERE Id = @id
  `);
  const requirement = result.recordset[0];
  if (!requirement) {
    return NextResponse.json({ ok: false, error: "Requirement not found." }, { status: 404 });
  }

  const linkedCases = await db.request().input("id", sql.Int, requirementId).query<{
    Id: number; TestCaseNumber: string; Title: string; LatestResult: string | null;
  }>(`
    SELECT tc.Id, tc.TestCaseNumber, tc.Title, latest.Result AS LatestResult
    FROM QaRequirementTestCases rtc
    JOIN QaTestCases tc ON tc.Id = rtc.TestCaseId
    OUTER APPLY (
      SELECT TOP 1 e.Result FROM QaTestExecutions e
      JOIN QaTestRunCases rc ON rc.Id = e.TestRunCaseId
      WHERE rc.TestCaseId = tc.Id
      ORDER BY e.ExecutedAt DESC
    ) latest
    WHERE rtc.RequirementId = @id
    ORDER BY tc.TestCaseNumber ASC
  `);

  return NextResponse.json({ ok: true, data: { ...requirement, testCases: linkedCases.recordset } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_edit");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const requirementId = Number(id);
  if (!Number.isInteger(requirementId)) {
    return NextResponse.json({ ok: false, error: "Invalid requirement id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const db = await getDb();

  const existingResult = await db.request().input("id", sql.Int, requirementId).query<QaRequirementRow>(
    "SELECT * FROM QaRequirements WHERE Id = @id"
  );
  const existing = existingResult.recordset[0];
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Requirement not found." }, { status: 404 });
  }

  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : existing.Title;
  const description = body?.description !== undefined ? (typeof body.description === "string" ? body.description.trim() || null : null) : existing.Description;
  const category = body?.category !== undefined ? (typeof body.category === "string" ? body.category.trim() || null : null) : existing.Category;
  const priority = typeof body?.priority === "string" && VALID_PRIORITIES.has(body.priority) ? body.priority : existing.Priority;
  const status = typeof body?.status === "string" && VALID_REQUIREMENT_STATUSES.has(body.status) ? body.status : existing.Status;

  if (title.length > MAX_TITLE_LENGTH) {
    return NextResponse.json({ ok: false, error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.` }, { status: 400 });
  }
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json({ ok: false, error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.` }, { status: 400 });
  }

  await db
    .request()
    .input("id", sql.Int, requirementId)
    .input("title", sql.NVarChar, title)
    .input("description", sql.NVarChar, description)
    .input("category", sql.NVarChar, category)
    .input("priority", sql.VarChar, priority)
    .input("status", sql.VarChar, status)
    .query(`
      UPDATE QaRequirements SET Title = @title, Description = @description, Category = @category,
        Priority = @priority, Status = @status, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `);

  // Replace-in-full when provided — same pattern as QaTestCaseRunTypes in test-cases/[id].
  if (Array.isArray(body?.testCaseIds)) {
    const testCaseIds: number[] = [...new Set<number>(body.testCaseIds.map((v: unknown) => Number(v)).filter((v: number) => Number.isInteger(v)))];
    await db.request().input("requirementId", sql.Int, requirementId).query("DELETE FROM QaRequirementTestCases WHERE RequirementId = @requirementId");
    for (const testCaseId of testCaseIds) {
      await db.request().input("requirementId", sql.Int, requirementId).input("testCaseId", sql.Int, testCaseId)
        .query(`
          IF EXISTS (SELECT Id FROM QaTestCases WHERE Id = @testCaseId)
          INSERT INTO QaRequirementTestCases (RequirementId, TestCaseId) VALUES (@requirementId, @testCaseId)
        `);
    }
  }

  await logAdminAction({ admin: qa, section: "qa", action: "update_requirement", details: existing.RequirementNumber, req });
  await logQaActivity({
    entityType: "Requirement", entityId: requirementId, action: "update", userId: qa.userId,
    previousValue: existing, newValue: { title, description, category, priority, status }, req,
  });

  return NextResponse.json({ ok: true });
}
