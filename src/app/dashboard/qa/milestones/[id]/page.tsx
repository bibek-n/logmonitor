import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getQaAccess } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { MilestoneDetailClient } from "@/components/qa/MilestoneDetailClient";

export const dynamic = "force-dynamic";

interface MilestoneDetail {
  Id: number; ProjectId: number; ReleaseId: number | null; Name: string; MilestoneType: string;
  DueDate: string | null; Status: string; Description: string | null;
}
interface LinkedPlan { Id: number; TestPlanNumber: string; Name: string; Status: string }

export default async function MilestoneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { qa, can } = await getQaAccess();
  if (!qa) return <QaAccessDenied title="Milestone" />;

  const { id } = await params;
  const milestoneId = Number(id);
  if (!Number.isInteger(milestoneId)) notFound();

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, milestoneId).query<MilestoneDetail>(`
    SELECT Id, ProjectId, ReleaseId, Name, MilestoneType,
      CONVERT(VARCHAR(10), DueDate, 126) AS DueDate, Status, Description
    FROM QaMilestones WHERE Id = @id
  `);
  const milestone = result.recordset[0];
  if (!milestone) notFound();

  const [projectResult, testPlansResult, availablePlansResult] = await Promise.all([
    db.request().input("id", sql.Int, milestone.ProjectId).query<{ Name: string }>("SELECT Name FROM QaProjects WHERE Id = @id"),
    db.request().input("id", sql.Int, milestoneId).query<LinkedPlan>(`
      SELECT tp.Id, tp.TestPlanNumber, tp.Name, tp.Status
      FROM QaMilestoneTestPlans mtp
      JOIN QaTestPlans tp ON tp.Id = mtp.TestPlanId
      WHERE mtp.MilestoneId = @id
      ORDER BY tp.TestPlanNumber ASC
    `),
    db.request().input("projectId", sql.Int, milestone.ProjectId).input("milestoneId", sql.Int, milestoneId).query<{ Id: number; TestPlanNumber: string; Name: string }>(`
      SELECT tp.Id, tp.TestPlanNumber, tp.Name FROM QaTestPlans tp
      WHERE tp.ProjectId = @projectId
        AND tp.Id NOT IN (SELECT TestPlanId FROM QaMilestoneTestPlans WHERE MilestoneId = @milestoneId)
      ORDER BY tp.TestPlanNumber ASC
    `),
  ]);

  const total = testPlansResult.recordset.length;
  const completed = testPlansResult.recordset.filter((p) => p.Status === "Completed").length;

  return (
    <MilestoneDetailClient
      milestone={{ ...milestone, testPlans: testPlansResult.recordset, progress: { total, completed } }}
      projectName={projectResult.recordset[0]?.Name ?? "—"}
      availablePlans={availablePlansResult.recordset}
      canEdit={!!can.qa_edit}
    />
  );
}
