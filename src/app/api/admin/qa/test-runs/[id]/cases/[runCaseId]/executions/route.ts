import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { VALID_EXECUTION_RESULTS, type QaTestExecutionRow } from "@/lib/qaShared";

const MAX_NOTES_LENGTH = 4000;

// Execution history for one run-case. Executions are append-only (see the migration script's
// comment on QaTestExecutions) — the newest row is the current result, older rows are the
// history the spec's "view execution history" requirement asks for.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; runCaseId: string }> }) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const { id, runCaseId } = await params;
  const runId = Number(id);
  const rcId = Number(runCaseId);
  if (!Number.isInteger(runId) || !Number.isInteger(rcId)) {
    return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  }

  const db = await getDb();
  const rcCheck = await db.request().input("id", sql.Int, rcId).input("runId", sql.Int, runId).query<{ Id: number }>(
    "SELECT Id FROM QaTestRunCases WHERE Id = @id AND TestRunId = @runId"
  );
  if (!rcCheck.recordset[0]) {
    return NextResponse.json({ ok: false, error: "Test run case not found." }, { status: 404 });
  }

  const result = await db.request().input("id", sql.Int, rcId).query<QaTestExecutionRow>(`
    SELECT Id, TestRunCaseId, Result, ActualResult, Notes, DurationMinutes, Browser, Device,
      OperatingSystem, AppVersion, ExecutedByUserId,
      CONVERT(VARCHAR(19), ExecutedAt, 126) AS ExecutedAt
    FROM QaTestExecutions WHERE TestRunCaseId = @id
    ORDER BY ExecutedAt DESC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; runCaseId: string }> }) {
  const qa = await requireQaPermission("qa_execute");
  if (!isQaSession(qa)) return qa;

  const { id, runCaseId } = await params;
  const runId = Number(id);
  const rcId = Number(runCaseId);
  if (!Number.isInteger(runId) || !Number.isInteger(rcId)) {
    return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const result_ = typeof body?.result === "string" ? body.result : "";
  const actualResult = typeof body?.actualResult === "string" ? (body.actualResult.trim() || null) : null;
  const notes = typeof body?.notes === "string" ? (body.notes.trim() || null) : null;
  const durationMinutes = body?.durationMinutes != null ? Number(body.durationMinutes) : null;
  const browser = typeof body?.browser === "string" ? (body.browser.trim() || null) : null;
  const device = typeof body?.device === "string" ? (body.device.trim() || null) : null;
  const operatingSystem = typeof body?.operatingSystem === "string" ? (body.operatingSystem.trim() || null) : null;
  const appVersion = typeof body?.appVersion === "string" ? (body.appVersion.trim() || null) : null;

  if (!VALID_EXECUTION_RESULTS.has(result_)) {
    return NextResponse.json({ ok: false, error: "A valid result is required." }, { status: 400 });
  }
  if (notes && notes.length > MAX_NOTES_LENGTH) {
    return NextResponse.json({ ok: false, error: `Notes must be ${MAX_NOTES_LENGTH} characters or fewer.` }, { status: 400 });
  }
  if (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 0)) {
    return NextResponse.json({ ok: false, error: "Duration must be a non-negative whole number of minutes." }, { status: 400 });
  }

  const db = await getDb();
  const rcCheck = await db.request().input("id", sql.Int, rcId).input("runId", sql.Int, runId).query<{ Id: number; TestCaseId: number }>(
    "SELECT Id, TestCaseId FROM QaTestRunCases WHERE Id = @id AND TestRunId = @runId"
  );
  if (!rcCheck.recordset[0]) {
    return NextResponse.json({ ok: false, error: "Test run case not found." }, { status: 404 });
  }

  const insertResult = await db
    .request()
    .input("testRunCaseId", sql.Int, rcId)
    .input("result", sql.VarChar, result_)
    .input("actualResult", sql.NVarChar, actualResult)
    .input("notes", sql.NVarChar, notes)
    .input("durationMinutes", sql.Int, durationMinutes)
    .input("browser", sql.NVarChar, browser)
    .input("device", sql.NVarChar, device)
    .input("operatingSystem", sql.NVarChar, operatingSystem)
    .input("appVersion", sql.NVarChar, appVersion)
    .input("executedByUserId", sql.Int, qa.userId)
    .query<QaTestExecutionRow>(`
      INSERT INTO QaTestExecutions (
        TestRunCaseId, Result, ActualResult, Notes, DurationMinutes, Browser, Device,
        OperatingSystem, AppVersion, ExecutedByUserId
      )
      OUTPUT INSERTED.Id, INSERTED.TestRunCaseId, INSERTED.Result, INSERTED.ActualResult,
        INSERTED.Notes, INSERTED.DurationMinutes, INSERTED.Browser, INSERTED.Device,
        INSERTED.OperatingSystem, INSERTED.AppVersion, INSERTED.ExecutedByUserId,
        CONVERT(VARCHAR(19), INSERTED.ExecutedAt, 126) AS ExecutedAt
      VALUES (
        @testRunCaseId, @result, @actualResult, @notes, @durationMinutes, @browser, @device,
        @operatingSystem, @appVersion, @executedByUserId
      )
    `);
  const execution = insertResult.recordset[0];

  await logAdminAction({ admin: qa, section: "qa", action: "submit_test_execution", details: `runCase ${rcId}: ${result_}`, req });
  await logQaActivity({ entityType: "TestExecution", entityId: execution.Id, action: "create", userId: qa.userId, newValue: execution, req });

  return NextResponse.json({ ok: true, data: execution });
}
