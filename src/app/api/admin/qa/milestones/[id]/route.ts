import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { VALID_MILESTONE_STATUSES, VALID_MILESTONE_TYPES, type QaMilestoneRow } from "@/lib/qaShared";

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 1000;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const milestoneId = Number(id);
  if (!Number.isInteger(milestoneId)) {
    return NextResponse.json({ ok: false, error: "Invalid milestone id." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, milestoneId).query<QaMilestoneRow>(`
    SELECT Id, ProjectId, ReleaseId, Name, MilestoneType,
      CONVERT(VARCHAR(10), DueDate, 126) AS DueDate,
      Status, Description, CreatedByUserId,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM QaMilestones WHERE Id = @id
  `);
  const milestone = result.recordset[0];
  if (!milestone) {
    return NextResponse.json({ ok: false, error: "Milestone not found." }, { status: 404 });
  }

  const testPlansResult = await db.request().input("id", sql.Int, milestoneId).query<{
    Id: number; TestPlanNumber: string; Name: string; Status: string;
  }>(`
    SELECT tp.Id, tp.TestPlanNumber, tp.Name, tp.Status
    FROM QaMilestoneTestPlans mtp
    JOIN QaTestPlans tp ON tp.Id = mtp.TestPlanId
    WHERE mtp.MilestoneId = @id
    ORDER BY tp.TestPlanNumber ASC
  `);

  const total = testPlansResult.recordset.length;
  const completed = testPlansResult.recordset.filter((tp) => tp.Status === "Completed").length;

  return NextResponse.json({
    ok: true,
    data: { ...milestone, testPlans: testPlansResult.recordset, progress: { total, completed } },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_edit");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const milestoneId = Number(id);
  if (!Number.isInteger(milestoneId)) {
    return NextResponse.json({ ok: false, error: "Invalid milestone id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const db = await getDb();

  const existingResult = await db.request().input("id", sql.Int, milestoneId).query<QaMilestoneRow>(
    "SELECT * FROM QaMilestones WHERE Id = @id"
  );
  const existing = existingResult.recordset[0];
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Milestone not found." }, { status: 404 });
  }

  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : existing.Name;
  const description = body?.description !== undefined ? (typeof body.description === "string" ? body.description.trim() || null : null) : existing.Description;
  const releaseId = body?.releaseId !== undefined ? (body.releaseId === null ? null : Number(body.releaseId)) : existing.ReleaseId;
  const milestoneType = typeof body?.milestoneType === "string" && VALID_MILESTONE_TYPES.has(body.milestoneType) ? body.milestoneType : existing.MilestoneType;
  const dueDate = body?.dueDate !== undefined ? (typeof body.dueDate === "string" ? body.dueDate.trim() || null : null) : existing.DueDate;
  const status = typeof body?.status === "string" && VALID_MILESTONE_STATUSES.has(body.status) ? body.status : existing.Status;

  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` }, { status: 400 });
  }
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json({ ok: false, error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.` }, { status: 400 });
  }
  if (releaseId !== null && !Number.isInteger(releaseId)) {
    return NextResponse.json({ ok: false, error: "Invalid releaseId." }, { status: 400 });
  }

  await db
    .request()
    .input("id", sql.Int, milestoneId)
    .input("name", sql.NVarChar, name)
    .input("description", sql.NVarChar, description)
    .input("releaseId", sql.Int, releaseId)
    .input("milestoneType", sql.VarChar, milestoneType)
    .input("dueDate", sql.VarChar, dueDate)
    .input("status", sql.VarChar, status)
    .query(`
      UPDATE QaMilestones SET Name = @name, Description = @description, ReleaseId = @releaseId,
        MilestoneType = @milestoneType, DueDate = @dueDate, Status = @status, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `);

  if (Array.isArray(body?.testPlanIds)) {
    const testPlanIds: number[] = [...new Set<number>(body.testPlanIds.map((v: unknown) => Number(v)).filter((v: number) => Number.isInteger(v)))];
    await db.request().input("milestoneId", sql.Int, milestoneId).query("DELETE FROM QaMilestoneTestPlans WHERE MilestoneId = @milestoneId");
    for (const testPlanId of testPlanIds) {
      await db.request().input("milestoneId", sql.Int, milestoneId).input("testPlanId", sql.Int, testPlanId)
        .query(`
          IF EXISTS (SELECT Id FROM QaTestPlans WHERE Id = @testPlanId)
          INSERT INTO QaMilestoneTestPlans (MilestoneId, TestPlanId) VALUES (@milestoneId, @testPlanId)
        `);
    }
  }

  await logAdminAction({ admin: qa, section: "qa", action: "update_milestone", details: existing.Name, req });
  await logQaActivity({
    entityType: "Milestone", entityId: milestoneId, action: "update", userId: qa.userId,
    previousValue: existing, newValue: { name, description, status }, req,
  });

  return NextResponse.json({ ok: true });
}
