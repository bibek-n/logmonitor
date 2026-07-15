import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getQaAccess } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { RequirementDetailClient } from "@/components/qa/RequirementDetailClient";

export const dynamic = "force-dynamic";

interface RequirementDetail {
  Id: number; RequirementNumber: string; ProjectId: number; Title: string; Description: string | null;
  Category: string | null; Priority: string; Status: string;
}
interface LinkedCase { Id: number; TestCaseNumber: string; Title: string; LatestResult: string | null }

export default async function RequirementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { qa, can } = await getQaAccess();
  if (!qa) return <QaAccessDenied title="Requirement" />;

  const { id } = await params;
  const requirementId = Number(id);
  if (!Number.isInteger(requirementId)) notFound();

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, requirementId).query<RequirementDetail>(`
    SELECT Id, RequirementNumber, ProjectId, Title, Description, Category, Priority, Status
    FROM QaRequirements WHERE Id = @id
  `);
  const requirement = result.recordset[0];
  if (!requirement) notFound();

  const [projectResult, linkedCasesResult, availableCasesResult] = await Promise.all([
    db.request().input("id", sql.Int, requirement.ProjectId).query<{ Name: string }>("SELECT Name FROM QaProjects WHERE Id = @id"),
    db.request().input("id", sql.Int, requirementId).query<LinkedCase>(`
      SELECT tc.Id, tc.TestCaseNumber, tc.Title, latest.Result AS LatestResult
      FROM QaRequirementTestCases rtc
      JOIN QaTestCases tc ON tc.Id = rtc.TestCaseId
      OUTER APPLY (
        SELECT TOP 1 e.Result FROM QaTestExecutions e
        JOIN QaTestRunCases rc ON rc.Id = e.TestRunCaseId
        WHERE rc.TestCaseId = tc.Id
        ORDER BY e.ExecutedAt DESC
      ) latest
      WHERE rtc.RequirementId = @id
      ORDER BY tc.TestCaseNumber ASC
    `),
    db.request().input("projectId", sql.Int, requirement.ProjectId).input("requirementId", sql.Int, requirementId).query<{ Id: number; TestCaseNumber: string; Title: string }>(`
      SELECT tc.Id, tc.TestCaseNumber, tc.Title FROM QaTestCases tc
      WHERE tc.ProjectId = @projectId AND tc.Status <> 'Archived'
        AND tc.Id NOT IN (SELECT TestCaseId FROM QaRequirementTestCases WHERE RequirementId = @requirementId)
      ORDER BY tc.TestCaseNumber ASC
    `),
  ]);

  return (
    <RequirementDetailClient
      requirement={{ ...requirement, testCases: linkedCasesResult.recordset }}
      projectName={projectResult.recordset[0]?.Name ?? "—"}
      availableCases={availableCasesResult.recordset}
      canEdit={!!can.qa_edit}
    />
  );
}
