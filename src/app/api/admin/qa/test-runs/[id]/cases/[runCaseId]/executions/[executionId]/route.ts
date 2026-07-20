import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import type { QaTestExecutionRow } from "@/lib/qaShared";

const MAX_NOTES_LENGTH = 4000;

// "Update result" only touches the annotation fields (ActualResult/Notes/Duration/
// environment details) on the MOST RECENT execution row for this run-case — the Result
// value itself is never edited in place. To change the result, submit a new execution via
// POST .../executions (that's what keeps execution history append-only and trustworthy).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; runCaseId: string; executionId: string }> }) {
  const qa = await requireQaPermission("qa_execute");
  if (!isQaSession(qa)) return qa;

  const { runCaseId, executionId } = await params;
  const rcId = Number(runCaseId);
  const execId = Number(executionId);
  if (!Number.isInteger(rcId) || !Number.isInteger(execId)) {
    return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  }

  const db = await getDb();
  const latestResult = await db.request().input("rcId", sql.Int, rcId).query<{ Id: number }>(
    "SELECT TOP 1 Id FROM QaTestExecutions WHERE TestRunCaseId = @rcId ORDER BY ExecutedAt DESC"
  );
  const latest = latestResult.recordset[0];
  if (!latest || latest.Id !== execId) {
    return NextResponse.json({ ok: false, error: "Only the most recent execution can be updated." }, { status: 400 });
  }

  const existingResult = await db.request().input("id", sql.Int, execId).query<QaTestExecutionRow>(
    "SELECT * FROM QaTestExecutions WHERE Id = @id"
  );
  const existing = existingResult.recordset[0];

  const body = await req.json().catch(() => null);
  const actualResult = body?.actualResult !== undefined ? (typeof body.actualResult === "string" ? body.actualResult.trim() || null : null) : existing.ActualResult;
  const notes = body?.notes !== undefined ? (typeof body.notes === "string" ? body.notes.trim() || null : null) : existing.Notes;
  const durationMinutes = body?.durationMinutes !== undefined ? (body.durationMinutes === null ? null : Number(body.durationMinutes)) : existing.DurationMinutes;

  if (notes && notes.length > MAX_NOTES_LENGTH) {
    return NextResponse.json({ ok: false, error: `Notes must be ${MAX_NOTES_LENGTH} characters or fewer.` }, { status: 400 });
  }
  if (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 0)) {
    return NextResponse.json({ ok: false, error: "Duration must be a non-negative whole number of minutes." }, { status: 400 });
  }

  await db
    .request()
    .input("id", sql.Int, execId)
    .input("actualResult", sql.NVarChar, actualResult)
    .input("notes", sql.NVarChar, notes)
    .input("durationMinutes", sql.Int, durationMinutes)
    .query("UPDATE QaTestExecutions SET ActualResult = @actualResult, Notes = @notes, DurationMinutes = @durationMinutes WHERE Id = @id");

  await logAdminAction({ admin: qa, section: "qa", action: "update_test_execution", details: `execution ${execId}`, req });
  await logQaActivity({
    entityType: "TestExecution", entityId: execId, action: "update", userId: qa.userId,
    previousValue: existing, newValue: { actualResult, notes, durationMinutes }, req,
  });

  return NextResponse.json({ ok: true });
}
