import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { VALID_PRIORITIES, VALID_BUG_SEVERITIES, VALID_BUG_STATUSES, BUG_RESOLVED_STATUSES, type QaBugRow } from "@/lib/qaShared";

const MAX_TITLE_LENGTH = 300;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const bugId = Number(id);
  if (!Number.isInteger(bugId)) {
    return NextResponse.json({ ok: false, error: "Invalid bug id." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, bugId).query<QaBugRow>(`
    SELECT Id, BugNumber, Title, Description, ProjectId, TestCaseId, TestExecutionId, TestRunId,
      StepsToReproduce, ExpectedResult, ActualResult, Severity, Priority, Status,
      AssignedDeveloperUserId, ReporterUserId, Environment, Browser, Device, AppVersion,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt,
      CONVERT(VARCHAR(19), ResolvedAt, 126) AS ResolvedAt
    FROM QaBugs WHERE Id = @id
  `);
  const bug = result.recordset[0];
  if (!bug) {
    return NextResponse.json({ ok: false, error: "Bug not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: bug });
}

// Covers assign (AssignedDeveloperUserId), change-status, retest ('Ready for Retest' is just
// another status value), and reopen ('Reopened') from the spec's endpoint list — all folded
// into one PATCH, matching how every other QA entity handles status transitions in this
// module (one route, not one endpoint per transition).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_manage_bugs");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const bugId = Number(id);
  if (!Number.isInteger(bugId)) {
    return NextResponse.json({ ok: false, error: "Invalid bug id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const db = await getDb();

  const existingResult = await db.request().input("id", sql.Int, bugId).query<QaBugRow>(
    "SELECT * FROM QaBugs WHERE Id = @id"
  );
  const existing = existingResult.recordset[0];
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Bug not found." }, { status: 404 });
  }

  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : existing.Title;
  const description = body?.description !== undefined ? (typeof body.description === "string" ? body.description.trim() || null : null) : existing.Description;
  const stepsToReproduce = body?.stepsToReproduce !== undefined ? (typeof body.stepsToReproduce === "string" ? body.stepsToReproduce.trim() || null : null) : existing.StepsToReproduce;
  const expectedResult = body?.expectedResult !== undefined ? (typeof body.expectedResult === "string" ? body.expectedResult.trim() || null : null) : existing.ExpectedResult;
  const actualResult = body?.actualResult !== undefined ? (typeof body.actualResult === "string" ? body.actualResult.trim() || null : null) : existing.ActualResult;
  const severity = typeof body?.severity === "string" && VALID_BUG_SEVERITIES.has(body.severity) ? body.severity : existing.Severity;
  const priority = typeof body?.priority === "string" && VALID_PRIORITIES.has(body.priority) ? body.priority : existing.Priority;
  const status = typeof body?.status === "string" && VALID_BUG_STATUSES.has(body.status) ? body.status : existing.Status;
  const assignedDeveloperUserId = body?.assignedDeveloperUserId !== undefined
    ? (body.assignedDeveloperUserId === null ? null : Number(body.assignedDeveloperUserId))
    : existing.AssignedDeveloperUserId;

  if (title.length > MAX_TITLE_LENGTH) {
    return NextResponse.json({ ok: false, error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.` }, { status: 400 });
  }
  if (assignedDeveloperUserId !== null && !Number.isInteger(assignedDeveloperUserId)) {
    return NextResponse.json({ ok: false, error: "Invalid assignedDeveloperUserId." }, { status: 400 });
  }

  const enteringResolved = BUG_RESOLVED_STATUSES.has(status) && !BUG_RESOLVED_STATUSES.has(existing.Status);
  const leavingResolved = !BUG_RESOLVED_STATUSES.has(status) && BUG_RESOLVED_STATUSES.has(existing.Status);

  const updateRequest = db
    .request()
    .input("id", sql.Int, bugId)
    .input("title", sql.NVarChar, title)
    .input("description", sql.NVarChar, description)
    .input("stepsToReproduce", sql.NVarChar, stepsToReproduce)
    .input("expectedResult", sql.NVarChar, expectedResult)
    .input("actualResult", sql.NVarChar, actualResult)
    .input("severity", sql.VarChar, severity)
    .input("priority", sql.VarChar, priority)
    .input("status", sql.VarChar, status)
    .input("assignedDeveloperUserId", sql.Int, assignedDeveloperUserId);

  let setClause = `
    Title = @title, Description = @description, StepsToReproduce = @stepsToReproduce,
    ExpectedResult = @expectedResult, ActualResult = @actualResult, Severity = @severity,
    Priority = @priority, Status = @status, AssignedDeveloperUserId = @assignedDeveloperUserId,
    UpdatedAt = SYSUTCDATETIME()
  `;
  if (enteringResolved) {
    setClause += ", ResolvedAt = SYSUTCDATETIME()";
  } else if (leavingResolved) {
    setClause += ", ResolvedAt = NULL";
  }

  await updateRequest.query(`UPDATE QaBugs SET ${setClause} WHERE Id = @id`);

  await logAdminAction({ admin: qa, section: "qa", action: "update_bug", details: `${existing.BugNumber} -> ${status}`, req });
  await logQaActivity({
    entityType: "Bug", entityId: bugId, action: "update", userId: qa.userId,
    previousValue: { Status: existing.Status, AssignedDeveloperUserId: existing.AssignedDeveloperUserId },
    newValue: { Status: status, AssignedDeveloperUserId: assignedDeveloperUserId }, req,
  });

  return NextResponse.json({ ok: true });
}
