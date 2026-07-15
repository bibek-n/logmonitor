import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getQaAccess } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { TestRunDetailClient } from "@/components/qa/TestRunDetailClient";

export const dynamic = "force-dynamic";

interface RunDetail {
  Id: number;
  TestRunNumber: string;
  Name: string;
  Description: string | null;
  ProjectId: number;
  ReleaseId: number | null;
  Environment: string | null;
  Browser: string | null;
  OperatingSystem: string | null;
  Device: string | null;
  StartDate: string | null;
  EndDate: string | null;
  Status: string;
  RunTypeId: number | null;
  RunTypeName: string | null;
  DeployedBuildVersion: string | null;
  DeployedAt: string | null;
  QaApprovedByUserId: number | null;
  QaApprovedAt: string | null;
  CreatedAt: string;
}

interface RunCaseRow {
  Id: number;
  TestCaseId: number;
  AssignedUserId: number | null;
  TestCaseNumber: string;
  Title: string;
  Priority: string;
  LatestResult: string | null;
  LatestExecutedAt: string | null;
  BugId: number | null;
  BugNumber: string | null;
  BugStatus: string | null;
}

export default async function TestRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { qa, can } = await getQaAccess();
  if (!qa) return <QaAccessDenied title="Test Run" />;

  const { id } = await params;
  const runId = Number(id);
  if (!Number.isInteger(runId)) notFound();

  const db = await getDb();
  const runResult = await db.request().input("id", sql.Int, runId).query<RunDetail>(`
    SELECT r.Id, r.TestRunNumber, r.Name, r.Description, r.ProjectId, r.ReleaseId, r.Environment, r.Browser,
      r.OperatingSystem, r.Device, CONVERT(VARCHAR(10), r.StartDate, 126) AS StartDate,
      CONVERT(VARCHAR(10), r.EndDate, 126) AS EndDate, r.Status, r.RunTypeId, rt.Name AS RunTypeName,
      r.DeployedBuildVersion,
      CONVERT(VARCHAR(19), r.DeployedAt, 126) AS DeployedAt,
      r.QaApprovedByUserId, CONVERT(VARCHAR(19), r.QaApprovedAt, 126) AS QaApprovedAt,
      CONVERT(VARCHAR(19), r.CreatedAt, 126) AS CreatedAt
    FROM QaTestRuns r
    LEFT JOIN QaTestRunTypes rt ON rt.Id = r.RunTypeId
    WHERE r.Id = @id
  `);
  const run = runResult.recordset[0];
  if (!run) notFound();

  const [caseRowsResult, projectResult, usersResult, availableCasesResult, blockingBugsResult, approverResult, releaseResult] = await Promise.all([
    db.request().input("id", sql.Int, runId).query<RunCaseRow>(`
      SELECT rc.Id, rc.TestCaseId, rc.AssignedUserId, tc.TestCaseNumber, tc.Title, tc.Priority,
        latest.Result AS LatestResult, CONVERT(VARCHAR(19), latest.ExecutedAt, 126) AS LatestExecutedAt,
        bug.Id AS BugId, bug.BugNumber, bug.Status AS BugStatus
      FROM QaTestRunCases rc
      JOIN QaTestCases tc ON tc.Id = rc.TestCaseId
      OUTER APPLY (SELECT TOP 1 e.Result, e.ExecutedAt FROM QaTestExecutions e WHERE e.TestRunCaseId = rc.Id ORDER BY e.ExecutedAt DESC) latest
      OUTER APPLY (
        SELECT TOP 1 b.Id, b.BugNumber, b.Status FROM QaBugs b
        WHERE b.TestCaseId = rc.TestCaseId AND b.TestRunId = rc.TestRunId
        ORDER BY b.CreatedAt DESC
      ) bug
      WHERE rc.TestRunId = @id
      ORDER BY tc.TestCaseNumber ASC
    `),
    db.request().input("id", sql.Int, run.ProjectId).query<{ Name: string }>("SELECT Name FROM QaProjects WHERE Id = @id"),
    db.query<{ Id: number; Username: string }>`SELECT Id, Username FROM Users ORDER BY Username ASC`,
    db.request().input("projectId", sql.Int, run.ProjectId).input("runId", sql.Int, runId).query<{ Id: number; TestCaseNumber: string; Title: string }>(`
      SELECT tc.Id, tc.TestCaseNumber, tc.Title FROM QaTestCases tc
      WHERE tc.ProjectId = @projectId AND tc.Status <> 'Archived'
        AND tc.Id NOT IN (SELECT TestCaseId FROM QaTestRunCases WHERE TestRunId = @runId)
      ORDER BY tc.TestCaseNumber ASC
    `),
    db.request().input("id", sql.Int, runId).query<{ Cnt: number }>(`
      SELECT COUNT(*) AS Cnt FROM QaBugs
      WHERE TestRunId = @id AND Severity IN ('Critical', 'High') AND Status NOT IN ('Closed', 'Rejected', 'Duplicate', 'Verified')
    `),
    run.QaApprovedByUserId
      ? db.request().input("id", sql.Int, run.QaApprovedByUserId).query<{ Username: string }>("SELECT Username FROM Users WHERE Id = @id")
      : Promise.resolve({ recordset: [] as { Username: string }[] }),
    run.ReleaseId
      ? db.request().input("id", sql.Int, run.ReleaseId).query<{ Name: string; Status: string }>("SELECT Name, Status FROM QaReleases WHERE Id = @id")
      : Promise.resolve({ recordset: [] as { Name: string; Status: string }[] }),
  ]);

  const release = releaseResult.recordset[0] ?? null;

  return (
    <TestRunDetailClient
      run={run}
      projectName={projectResult.recordset[0]?.Name ?? "—"}
      runCases={caseRowsResult.recordset}
      users={usersResult.recordset}
      availableCases={availableCasesResult.recordset}
      blockingBugCount={blockingBugsResult.recordset[0]?.Cnt ?? 0}
      qaApprovedByUsername={approverResult.recordset[0]?.Username ?? null}
      releaseName={release?.Name ?? null}
      releaseStatus={release?.Status ?? null}
      canManage={!!can.qa_manage_runs}
      canExecute={!!can.qa_execute}
    />
  );
}
