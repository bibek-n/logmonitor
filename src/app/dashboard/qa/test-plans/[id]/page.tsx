import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getQaAccess } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { TestPlanDetailClient } from "@/components/qa/TestPlanDetailClient";

export const dynamic = "force-dynamic";

interface TestPlanDetail {
  Id: number; TestPlanNumber: string; ProjectId: number; ReleaseId: number | null; Name: string;
  Description: string | null; Status: string;
}
interface LinkedRun { Id: number; TestRunNumber: string; Name: string; Status: string; Total: number; Passed: number; Executed: number }

export default async function TestPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { qa, can } = await getQaAccess();
  if (!qa) return <QaAccessDenied title="Test Plan" />;

  const { id } = await params;
  const testPlanId = Number(id);
  if (!Number.isInteger(testPlanId)) notFound();

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, testPlanId).query<TestPlanDetail>(`
    SELECT Id, TestPlanNumber, ProjectId, ReleaseId, Name, Description, Status FROM QaTestPlans WHERE Id = @id
  `);
  const testPlan = result.recordset[0];
  if (!testPlan) notFound();

  const [projectResult, runsResult, availableRunsResult] = await Promise.all([
    db.request().input("id", sql.Int, testPlan.ProjectId).query<{ Name: string }>("SELECT Name FROM QaProjects WHERE Id = @id"),
    db.request().input("id", sql.Int, testPlanId).query<LinkedRun>(`
      SELECT r.Id, r.TestRunNumber, r.Name, r.Status,
        COUNT(rc.Id) AS Total,
        SUM(CASE WHEN latest.Result = 'Passed' THEN 1 ELSE 0 END) AS Passed,
        SUM(CASE WHEN latest.Result IS NOT NULL THEN 1 ELSE 0 END) AS Executed
      FROM QaTestPlanRuns tpr
      JOIN QaTestRuns r ON r.Id = tpr.TestRunId
      LEFT JOIN QaTestRunCases rc ON rc.TestRunId = r.Id
      OUTER APPLY (
        SELECT TOP 1 e.Result FROM QaTestExecutions e WHERE e.TestRunCaseId = rc.Id ORDER BY e.ExecutedAt DESC
      ) latest
      WHERE tpr.TestPlanId = @id
      GROUP BY r.Id, r.TestRunNumber, r.Name, r.Status
      ORDER BY r.TestRunNumber ASC
    `),
    db.request().input("projectId", sql.Int, testPlan.ProjectId).input("testPlanId", sql.Int, testPlanId).query<{ Id: number; TestRunNumber: string; Name: string }>(`
      SELECT r.Id, r.TestRunNumber, r.Name FROM QaTestRuns r
      WHERE r.ProjectId = @projectId
        AND r.Id NOT IN (SELECT TestRunId FROM QaTestPlanRuns WHERE TestPlanId = @testPlanId)
      ORDER BY r.TestRunNumber ASC
    `),
  ]);

  const progress = runsResult.recordset.reduce(
    (acc, r) => ({ total: acc.total + r.Total, passed: acc.passed + r.Passed, executed: acc.executed + r.Executed }),
    { total: 0, passed: 0, executed: 0 }
  );

  return (
    <TestPlanDetailClient
      testPlan={{ ...testPlan, runs: runsResult.recordset, progress }}
      projectName={projectResult.recordset[0]?.Name ?? "—"}
      availableRuns={availableRunsResult.recordset}
      canEdit={!!can.qa_manage_runs}
    />
  );
}
