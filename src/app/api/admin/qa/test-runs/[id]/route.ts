import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { VALID_TEST_RUN_STATUSES, type QaTestRunRow } from "@/lib/qaShared";

const MAX_BUILD_VERSION_LENGTH = 50;

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 1000;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const runId = Number(id);
  if (!Number.isInteger(runId)) {
    return NextResponse.json({ ok: false, error: "Invalid test run id." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, runId).query<QaTestRunRow>(`
    SELECT Id, TestRunNumber, Name, Description, ProjectId, ReleaseId, Environment, Browser,
      OperatingSystem, Device,
      CONVERT(VARCHAR(10), StartDate, 126) AS StartDate,
      CONVERT(VARCHAR(10), EndDate, 126) AS EndDate,
      Status, RunTypeId, DeployedBuildVersion,
      CONVERT(VARCHAR(19), DeployedAt, 126) AS DeployedAt,
      QaApprovedByUserId, CONVERT(VARCHAR(19), QaApprovedAt, 126) AS QaApprovedAt,
      CreatedByUserId,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM QaTestRuns WHERE Id = @id
  `);
  const run = result.recordset[0];
  if (!run) {
    return NextResponse.json({ ok: false, error: "Test run not found." }, { status: 404 });
  }

  // Progress: for each run-case, its latest execution result (or 'Not Run' if never executed).
  const progressResult = await db.request().input("id", sql.Int, runId).query<{ Result: string; Cnt: number }>(`
    SELECT COALESCE(latest.Result, 'Not Run') AS Result, COUNT(*) AS Cnt
    FROM QaTestRunCases rc
    OUTER APPLY (
      SELECT TOP 1 e.Result FROM QaTestExecutions e
      WHERE e.TestRunCaseId = rc.Id ORDER BY e.ExecutedAt DESC
    ) latest
    WHERE rc.TestRunId = @id
    GROUP BY latest.Result
  `);

  // Open Critical/High bugs tied to this run — the QA-approval gate needs this count, and the
  // run detail page shows it too so a tester can see why "QA Approve" might be disabled.
  const blockingBugsResult = await db.request().input("id", sql.Int, runId).query<{ Cnt: number }>(`
    SELECT COUNT(*) AS Cnt FROM QaBugs
    WHERE TestRunId = @id AND Severity IN ('Critical', 'High') AND Status NOT IN ('Closed', 'Rejected', 'Duplicate', 'Verified')
  `);

  return NextResponse.json({
    ok: true,
    data: { ...run, progress: progressResult.recordset, blockingBugCount: blockingBugsResult.recordset[0]?.Cnt ?? 0 },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_manage_runs");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const runId = Number(id);
  if (!Number.isInteger(runId)) {
    return NextResponse.json({ ok: false, error: "Invalid test run id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const db = await getDb();

  const existingResult = await db.request().input("id", sql.Int, runId).query<QaTestRunRow>(
    "SELECT * FROM QaTestRuns WHERE Id = @id"
  );
  const existing = existingResult.recordset[0];
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Test run not found." }, { status: 404 });
  }

  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : existing.Name;
  const description = body?.description !== undefined ? (typeof body.description === "string" ? body.description.trim() || null : null) : existing.Description;
  const environment = body?.environment !== undefined ? (typeof body.environment === "string" ? body.environment.trim() || null : null) : existing.Environment;
  const browser = body?.browser !== undefined ? (typeof body.browser === "string" ? body.browser.trim() || null : null) : existing.Browser;
  const operatingSystem = body?.operatingSystem !== undefined ? (typeof body.operatingSystem === "string" ? body.operatingSystem.trim() || null : null) : existing.OperatingSystem;
  const device = body?.device !== undefined ? (typeof body.device === "string" ? body.device.trim() || null : null) : existing.Device;
  const releaseId = body?.releaseId !== undefined ? (body.releaseId === null ? null : Number(body.releaseId)) : existing.ReleaseId;
  const status = typeof body?.status === "string" && VALID_TEST_RUN_STATUSES.has(body.status) ? body.status : existing.Status;
  const runTypeId = body?.runTypeId !== undefined ? (body.runTypeId === null ? null : Number(body.runTypeId)) : existing.RunTypeId;

  // "Deploy Application to QA": recording a build version marks the deployment event —
  // DeployedAt stamps the first time this run records a build (re-sending the same or a new
  // version later just updates the version, matching how a run can get redeployed mid-cycle).
  const deployingBuild = typeof body?.deployedBuildVersion === "string" && body.deployedBuildVersion.trim().length > 0;
  const deployedBuildVersion = deployingBuild ? body.deployedBuildVersion.trim().slice(0, MAX_BUILD_VERSION_LENGTH) : existing.DeployedBuildVersion;

  // "QA Approval": an explicit sign-off gate before Production Release. Only obtainable once
  // the run is Completed and has no open Critical/High bug still tied to it — never trust a
  // client-sent "approved" flag without re-checking both conditions server-side.
  const requestingApproval = body?.qaApproved === true;

  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` }, { status: 400 });
  }
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json({ ok: false, error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.` }, { status: 400 });
  }
  if (releaseId !== null && !Number.isInteger(releaseId)) {
    return NextResponse.json({ ok: false, error: "Invalid releaseId." }, { status: 400 });
  }
  if (runTypeId !== null && !Number.isInteger(runTypeId)) {
    return NextResponse.json({ ok: false, error: "Invalid runTypeId." }, { status: 400 });
  }
  if (runTypeId !== null && runTypeId !== existing.RunTypeId) {
    const runTypeCheck = await db.request().input("id", sql.Int, runTypeId).query<{ Id: number }>(
      "SELECT Id FROM QaTestRunTypes WHERE Id = @id AND IsActive = 1"
    );
    if (!runTypeCheck.recordset[0]) {
      return NextResponse.json({ ok: false, error: "Run type not found." }, { status: 404 });
    }
  }

  if (requestingApproval) {
    if (status !== "Completed") {
      return NextResponse.json({ ok: false, error: "A test run can only be QA-approved once its Status is Completed." }, { status: 400 });
    }
    const blockingBugs = await db.request().input("id", sql.Int, runId).query<{ Cnt: number }>(`
      SELECT COUNT(*) AS Cnt FROM QaBugs
      WHERE TestRunId = @id AND Severity IN ('Critical', 'High') AND Status NOT IN ('Closed', 'Rejected', 'Duplicate', 'Verified')
    `);
    if ((blockingBugs.recordset[0]?.Cnt ?? 0) > 0) {
      return NextResponse.json({ ok: false, error: "Cannot QA-approve: this run still has an open Critical or High severity bug." }, { status: 400 });
    }
  }

  // A run's StartDate/EndDate auto-stamp on the first transition into/out of "In Progress" —
  // "start"/"pause"/"complete" from the spec's endpoint list are all just this same status
  // transition, matching how test-suites/test-cases handle Status via a single PATCH rather
  // than one route per transition.
  const startDate = status === "In Progress" && !existing.StartDate ? new Date() : undefined;
  const endDate = (status === "Completed" || status === "Cancelled") && !existing.EndDate ? new Date() : undefined;

  const updateRequest = db
    .request()
    .input("id", sql.Int, runId)
    .input("name", sql.NVarChar, name)
    .input("description", sql.NVarChar, description)
    .input("environment", sql.NVarChar, environment)
    .input("browser", sql.NVarChar, browser)
    .input("operatingSystem", sql.NVarChar, operatingSystem)
    .input("device", sql.NVarChar, device)
    .input("releaseId", sql.Int, releaseId)
    .input("status", sql.VarChar, status)
    .input("runTypeId", sql.Int, runTypeId);

  let setClause = `
    Name = @name, Description = @description, Environment = @environment, Browser = @browser,
    OperatingSystem = @operatingSystem, Device = @device, ReleaseId = @releaseId, Status = @status,
    RunTypeId = @runTypeId, UpdatedAt = SYSUTCDATETIME()
  `;
  if (startDate) {
    updateRequest.input("startDate", sql.Date, startDate);
    setClause += ", StartDate = @startDate";
  }
  if (endDate) {
    updateRequest.input("endDate", sql.Date, endDate);
    setClause += ", EndDate = @endDate";
  }
  if (deployingBuild) {
    updateRequest.input("deployedBuildVersion", sql.NVarChar, deployedBuildVersion);
    setClause += ", DeployedBuildVersion = @deployedBuildVersion, DeployedAt = SYSUTCDATETIME()";
  }
  if (requestingApproval) {
    updateRequest.input("qaApprovedByUserId", sql.Int, qa.userId);
    setClause += ", QaApprovedByUserId = @qaApprovedByUserId, QaApprovedAt = SYSUTCDATETIME()";
  }

  await updateRequest.query(`UPDATE QaTestRuns SET ${setClause} WHERE Id = @id`);

  const action = requestingApproval ? "qa_approve_test_run" : deployingBuild ? "deploy_test_run_to_qa" : "update_test_run";
  const details = requestingApproval
    ? `${existing.TestRunNumber} QA-approved`
    : deployingBuild
      ? `${existing.TestRunNumber} deployed build ${deployedBuildVersion}`
      : `${existing.TestRunNumber} -> ${status}`;
  await logAdminAction({ admin: qa, section: "qa", action, details, req });
  await logQaActivity({
    entityType: "TestRun", entityId: runId, action: requestingApproval ? "qa_approve" : deployingBuild ? "deploy" : "update",
    userId: qa.userId,
    previousValue: { Status: existing.Status, DeployedBuildVersion: existing.DeployedBuildVersion, QaApprovedAt: existing.QaApprovedAt },
    newValue: { Status: status, DeployedBuildVersion: deployedBuildVersion, QaApprovedAt: requestingApproval ? new Date().toISOString() : existing.QaApprovedAt },
    req,
  });

  return NextResponse.json({ ok: true });
}
