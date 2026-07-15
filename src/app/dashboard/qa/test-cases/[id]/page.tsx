import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getQaAccess } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { TestCaseDetailClient } from "@/components/qa/TestCaseDetailClient";

export const dynamic = "force-dynamic";

interface CaseDetail {
  Id: number;
  ProjectId: number;
  ModuleId: number | null;
  TestSuiteId: number;
  TestCaseNumber: string;
  Title: string;
  Description: string | null;
  Preconditions: string | null;
  ExpectedResult: string | null;
  Priority: string;
  Severity: string | null;
  TestType: string;
  AutomationStatus: string;
  EstimatedMinutes: number | null;
  Status: string;
  ReviewedByUsername: string | null;
  ReviewedAt: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

interface StepRow { Id: number; StepNumber: number; Action: string; TestData: string | null; ExpectedResult: string | null }
interface HistoryRow { Id: number; Result: string; ActualResult: string | null; Notes: string | null; ExecutedAt: string; ExecutedByUsername: string | null; TestRunNumber: string }
interface AttachmentRow { Id: number; OriginalFileName: string; SizeBytes: number; UploadedAt: string }

export default async function TestCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { qa, can } = await getQaAccess();
  if (!qa) return <QaAccessDenied title="Test Case" />;

  const { id } = await params;
  const testCaseId = Number(id);
  if (!Number.isInteger(testCaseId)) notFound();

  const db = await getDb();
  const [caseResult, stepsResult, tagsResult, historyResult, attachmentsResult, runTypeIdsResult] = await Promise.all([
    db.request().input("id", sql.Int, testCaseId).query<CaseDetail>(`
      SELECT tc.Id, tc.ProjectId, tc.ModuleId, tc.TestSuiteId, tc.TestCaseNumber, tc.Title, tc.Description, tc.Preconditions,
        tc.ExpectedResult, tc.Priority, tc.Severity, tc.TestType, tc.AutomationStatus, tc.EstimatedMinutes, tc.Status,
        ru.Username AS ReviewedByUsername, CONVERT(VARCHAR(19), tc.ReviewedAt, 126) AS ReviewedAt,
        CONVERT(VARCHAR(19), tc.CreatedAt, 126) AS CreatedAt, CONVERT(VARCHAR(19), tc.UpdatedAt, 126) AS UpdatedAt
      FROM QaTestCases tc
      LEFT JOIN Users ru ON ru.Id = tc.ReviewedByUserId
      WHERE tc.Id = @id
    `),
    db.request().input("id", sql.Int, testCaseId).query<StepRow>(
      "SELECT Id, StepNumber, Action, TestData, ExpectedResult FROM QaTestCaseSteps WHERE TestCaseId = @id ORDER BY StepNumber ASC"
    ),
    db.request().input("id", sql.Int, testCaseId).query<{ Tag: string }>("SELECT Tag FROM QaTestCaseTags WHERE TestCaseId = @id ORDER BY Tag ASC"),
    db.request().input("testCaseId", sql.Int, testCaseId).query<HistoryRow>(`
      SELECT e.Id, e.Result, e.ActualResult, e.Notes, CONVERT(VARCHAR(19), e.ExecutedAt, 126) AS ExecutedAt,
        u.Username AS ExecutedByUsername, run.TestRunNumber
      FROM QaTestExecutions e
      JOIN QaTestRunCases rc ON rc.Id = e.TestRunCaseId
      JOIN QaTestRuns run ON run.Id = rc.TestRunId
      LEFT JOIN Users u ON u.Id = e.ExecutedByUserId
      WHERE rc.TestCaseId = @testCaseId
      ORDER BY e.ExecutedAt DESC
    `),
    db.request().input("entityType", sql.VarChar, "TestCase").input("entityId", sql.Int, testCaseId).query<AttachmentRow>(`
      SELECT Id, OriginalFileName, SizeBytes, CONVERT(VARCHAR(19), UploadedAt, 126) AS UploadedAt
      FROM QaAttachments WHERE EntityType = @entityType AND EntityId = @entityId ORDER BY UploadedAt DESC
    `),
    db.request().input("id", sql.Int, testCaseId).query<{ RunTypeId: number }>(
      "SELECT RunTypeId FROM QaTestCaseRunTypes WHERE TestCaseId = @id ORDER BY RunTypeId ASC"
    ),
  ]);

  const testCase = caseResult.recordset[0];
  if (!testCase) notFound();

  const suites = await db.request().input("projectId", sql.Int, testCase.ProjectId).query<{ Id: number; ProjectId: number; ModuleId: number | null; Name: string }>(
    "SELECT Id, ProjectId, ModuleId, Name FROM QaTestSuites WHERE ProjectId = @projectId AND Status <> 'Archived' ORDER BY Name ASC"
  );
  const projects = await db.query<{ Id: number; Name: string }>`SELECT Id, Name FROM QaProjects WHERE IsActive = 1 ORDER BY Name ASC`;
  const runTypes = await db.query<{ Id: number; Name: string }>`SELECT Id, Name FROM QaTestRunTypes WHERE IsActive = 1 ORDER BY Id ASC`;

  return (
    <TestCaseDetailClient
      testCase={testCase}
      steps={stepsResult.recordset}
      tags={tagsResult.recordset.map((t) => t.Tag)}
      history={historyResult.recordset}
      attachments={attachmentsResult.recordset}
      suites={suites.recordset}
      projects={projects.recordset}
      runTypes={runTypes.recordset}
      runTypeIds={runTypeIdsResult.recordset.map((r) => r.RunTypeId)}
      canEdit={!!can.qa_edit}
      canDelete={!!can.qa_delete}
      canCreate={!!can.qa_create}
    />
  );
}
