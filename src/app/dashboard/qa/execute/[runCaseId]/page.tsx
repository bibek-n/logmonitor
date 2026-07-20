import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getQaSession } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { ExecuteTestClient } from "@/components/qa/ExecuteTestClient";

export const dynamic = "force-dynamic";

interface RunCaseInfo {
  RunCaseId: number;
  TestRunId: number;
  TestRunNumber: string;
  TestCaseId: number;
  ProjectId: number;
  TestCaseNumber: string;
  Title: string;
  Description: string | null;
  Preconditions: string | null;
  ExpectedResult: string | null;
  Priority: string;
}

interface StepRow { StepNumber: number; Action: string; TestData: string | null; ExpectedResult: string | null }
interface HistoryRow { Id: number; Result: string; Notes: string | null; ExecutedAt: string; ExecutedByUsername: string | null }

export default async function ExecuteTestPage({ params }: { params: Promise<{ runCaseId: string }> }) {
  const qa = await getQaSession("qa_execute");
  if (!qa) return <QaAccessDenied title="Execute Test" />;

  const { runCaseId } = await params;
  const rcId = Number(runCaseId);
  if (!Number.isInteger(rcId)) notFound();

  const db = await getDb();
  const infoResult = await db.request().input("id", sql.Int, rcId).query<RunCaseInfo>(`
    SELECT rc.Id AS RunCaseId, rc.TestRunId, r.TestRunNumber, tc.Id AS TestCaseId, tc.ProjectId,
      tc.TestCaseNumber, tc.Title, tc.Description, tc.Preconditions, tc.ExpectedResult, tc.Priority
    FROM QaTestRunCases rc
    JOIN QaTestRuns r ON r.Id = rc.TestRunId
    JOIN QaTestCases tc ON tc.Id = rc.TestCaseId
    WHERE rc.Id = @id
  `);
  const info = infoResult.recordset[0];
  if (!info) notFound();

  const [stepsResult, historyResult] = await Promise.all([
    db.request().input("id", sql.Int, info.TestCaseId).query<StepRow>(
      "SELECT StepNumber, Action, TestData, ExpectedResult FROM QaTestCaseSteps WHERE TestCaseId = @id ORDER BY StepNumber ASC"
    ),
    db.request().input("id", sql.Int, rcId).query<HistoryRow>(`
      SELECT e.Id, e.Result, e.Notes, CONVERT(VARCHAR(19), e.ExecutedAt, 126) AS ExecutedAt, u.Username AS ExecutedByUsername
      FROM QaTestExecutions e LEFT JOIN Users u ON u.Id = e.ExecutedByUserId
      WHERE e.TestRunCaseId = @id ORDER BY e.ExecutedAt DESC
    `),
  ]);

  return <ExecuteTestClient info={info} steps={stepsResult.recordset} history={historyResult.recordset} />;
}
