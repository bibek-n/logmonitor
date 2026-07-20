import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getQaAccess } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { BugDetailClient } from "@/components/qa/BugDetailClient";

export const dynamic = "force-dynamic";

interface BugDetail {
  Id: number; BugNumber: string; Title: string; Description: string | null; ProjectId: number;
  TestCaseId: number | null; TestExecutionId: number | null; TestRunId: number | null;
  StepsToReproduce: string | null; ExpectedResult: string | null; ActualResult: string | null;
  Severity: string; Priority: string; Status: string; AssignedDeveloperUserId: number | null;
  ReporterUserId: number | null; Environment: string | null; Browser: string | null; Device: string | null;
  AppVersion: string | null; CreatedAt: string; UpdatedAt: string; ResolvedAt: string | null;
}

export default async function BugDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { qa, can } = await getQaAccess();
  if (!qa) return <QaAccessDenied title="Bug" />;

  const { id } = await params;
  const bugId = Number(id);
  if (!Number.isInteger(bugId)) notFound();

  const db = await getDb();
  const bugResult = await db.request().input("id", sql.Int, bugId).query<BugDetail>(`
    SELECT Id, BugNumber, Title, Description, ProjectId, TestCaseId, TestExecutionId, TestRunId,
      StepsToReproduce, ExpectedResult, ActualResult, Severity, Priority, Status,
      AssignedDeveloperUserId, ReporterUserId, Environment, Browser, Device, AppVersion,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt, CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt,
      CONVERT(VARCHAR(19), ResolvedAt, 126) AS ResolvedAt
    FROM QaBugs WHERE Id = @id
  `);
  const bug = bugResult.recordset[0];
  if (!bug) notFound();

  const [users, testCase, reporter, attachmentsResult, retestResult] = await Promise.all([
    db.query<{ Id: number; Username: string }>`SELECT Id, Username FROM Users ORDER BY Username ASC`,
    bug.TestCaseId
      ? db.request().input("id", sql.Int, bug.TestCaseId).query<{ TestCaseNumber: string; Title: string }>("SELECT TestCaseNumber, Title FROM QaTestCases WHERE Id = @id")
      : Promise.resolve({ recordset: [] as { TestCaseNumber: string; Title: string }[] }),
    bug.ReporterUserId
      ? db.request().input("id", sql.Int, bug.ReporterUserId).query<{ Username: string }>("SELECT Username FROM Users WHERE Id = @id")
      : Promise.resolve({ recordset: [] as { Username: string }[] }),
    db.request().input("entityType", sql.VarChar, "Bug").input("entityId", sql.Int, bugId).query<{ Id: number; OriginalFileName: string; SizeBytes: number; UploadedAt: string }>(`
      SELECT Id, OriginalFileName, SizeBytes, CONVERT(VARCHAR(19), UploadedAt, 126) AS UploadedAt
      FROM QaAttachments WHERE EntityType = @entityType AND EntityId = @entityId ORDER BY UploadedAt DESC
    `),
    // Resolves the exact run-case the "Retest" action re-executes: the same test case, within
    // the same test run this bug was filed from. Only possible when the bug has both — which
    // is always true for a bug filed via "File Bug from this Failure" on the execute screen.
    bug.TestRunId && bug.TestCaseId
      ? db.request().input("runId", sql.Int, bug.TestRunId).input("caseId", sql.Int, bug.TestCaseId).query<{
          RunCaseId: number; LatestResult: string | null; LatestExecutedAt: string | null;
        }>(`
          SELECT rc.Id AS RunCaseId, latest.Result AS LatestResult, CONVERT(VARCHAR(19), latest.ExecutedAt, 126) AS LatestExecutedAt
          FROM QaTestRunCases rc
          OUTER APPLY (SELECT TOP 1 e.Result, e.ExecutedAt FROM QaTestExecutions e WHERE e.TestRunCaseId = rc.Id ORDER BY e.ExecutedAt DESC) latest
          WHERE rc.TestRunId = @runId AND rc.TestCaseId = @caseId
        `)
      : Promise.resolve({ recordset: [] as { RunCaseId: number; LatestResult: string | null; LatestExecutedAt: string | null }[] }),
  ]);

  const retest = retestResult.recordset[0] ?? null;

  return (
    <BugDetailClient
      bug={bug}
      users={users.recordset}
      testCase={testCase.recordset[0] ?? null}
      reporterUsername={reporter.recordset[0]?.Username ?? null}
      attachments={attachmentsResult.recordset}
      retestRunCaseId={retest?.RunCaseId ?? null}
      retestLatestResult={retest?.LatestResult ?? null}
      retestLatestAt={retest?.LatestExecutedAt ?? null}
      canEdit={!!can.qa_manage_bugs}
    />
  );
}
