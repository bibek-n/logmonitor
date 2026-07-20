import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; runCaseId: string }> }) {
  const qa = await requireQaPermission("qa_manage_runs");
  if (!isQaSession(qa)) return qa;

  const { id, runCaseId } = await params;
  const runId = Number(id);
  const rcId = Number(runCaseId);
  if (!Number.isInteger(runId) || !Number.isInteger(rcId)) {
    return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const assignedUserId = body?.assignedUserId !== undefined ? (body.assignedUserId === null ? null : Number(body.assignedUserId)) : undefined;
  if (assignedUserId !== undefined && assignedUserId !== null && !Number.isInteger(assignedUserId)) {
    return NextResponse.json({ ok: false, error: "Invalid assignedUserId." }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, rcId).input("runId", sql.Int, runId).query<{ Id: number; AssignedUserId: number | null }>(
    "SELECT Id, AssignedUserId FROM QaTestRunCases WHERE Id = @id AND TestRunId = @runId"
  );
  if (!existing.recordset[0]) {
    return NextResponse.json({ ok: false, error: "Test run case not found." }, { status: 404 });
  }

  if (assignedUserId !== undefined) {
    await db.request().input("id", sql.Int, rcId).input("assignedUserId", sql.Int, assignedUserId)
      .query("UPDATE QaTestRunCases SET AssignedUserId = @assignedUserId WHERE Id = @id");
  }

  await logAdminAction({ admin: qa, section: "qa", action: "assign_test_run_case", details: `runCase ${rcId} -> user ${assignedUserId}`, req });
  await logQaActivity({
    entityType: "TestRunCase", entityId: rcId, action: "assign", userId: qa.userId,
    previousValue: { AssignedUserId: existing.recordset[0].AssignedUserId }, newValue: { AssignedUserId: assignedUserId }, req,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; runCaseId: string }> }) {
  const qa = await requireQaPermission("qa_manage_runs");
  if (!isQaSession(qa)) return qa;

  const { id, runCaseId } = await params;
  const runId = Number(id);
  const rcId = Number(runCaseId);
  if (!Number.isInteger(runId) || !Number.isInteger(rcId)) {
    return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, rcId).input("runId", sql.Int, runId).query<{ Id: number }>(
    "SELECT Id FROM QaTestRunCases WHERE Id = @id AND TestRunId = @runId"
  );
  if (!existing.recordset[0]) {
    return NextResponse.json({ ok: false, error: "Test run case not found." }, { status: 404 });
  }

  // Execution history for this run-case is deleted too — same FK-safe explicit-order
  // child-delete convention this app uses everywhere (no ON DELETE CASCADE anywhere).
  await db.request().input("id", sql.Int, rcId).query("DELETE FROM QaTestExecutions WHERE TestRunCaseId = @id");
  await db.request().input("id", sql.Int, rcId).query("DELETE FROM QaTestRunCases WHERE Id = @id");

  await logAdminAction({ admin: qa, section: "qa", action: "remove_test_run_case", details: `runCase ${rcId}`, req });
  await logQaActivity({ entityType: "TestRunCase", entityId: rcId, action: "remove", userId: qa.userId, req });

  return NextResponse.json({ ok: true });
}
