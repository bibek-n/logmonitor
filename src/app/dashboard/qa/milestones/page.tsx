import { getDb } from "@/lib/db";
import { getQaAccess } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { MilestonesClient } from "@/components/qa/MilestonesClient";

export const dynamic = "force-dynamic";

export default async function MilestonesPage() {
  const { qa, can } = await getQaAccess();
  if (!qa) return <QaAccessDenied title="Milestones" />;

  const db = await getDb();
  const [projects, releases] = await Promise.all([
    db.query<{ Id: number; Name: string }>`SELECT Id, Name FROM QaProjects WHERE IsActive = 1 ORDER BY Name ASC`,
    db.query<{ Id: number; ProjectId: number; Name: string }>`SELECT Id, ProjectId, Name FROM QaReleases ORDER BY Name ASC`,
  ]);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Milestones</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Sprints and release milestones, tracked by the test plans linked to them.
      </p>
      <MilestonesClient projects={projects.recordset} releases={releases.recordset} canManage={!!can.qa_create} />
    </div>
  );
}
