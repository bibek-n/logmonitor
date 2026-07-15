import { getDb } from "@/lib/db";
import { getQaAccess } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { TestPlansClient } from "@/components/qa/TestPlansClient";

export const dynamic = "force-dynamic";

export default async function TestPlansPage() {
  const { qa, can } = await getQaAccess();
  if (!qa) return <QaAccessDenied title="Test Plans" />;

  const db = await getDb();
  const [projects, releases] = await Promise.all([
    db.query<{ Id: number; Name: string }>`SELECT Id, Name FROM QaProjects WHERE IsActive = 1 ORDER BY Name ASC`,
    db.query<{ Id: number; ProjectId: number; Name: string }>`SELECT Id, ProjectId, Name FROM QaReleases ORDER BY Name ASC`,
  ]);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Test Plans</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Wrap multiple test runs into one plan and track progress across them.
      </p>
      <TestPlansClient projects={projects.recordset} releases={releases.recordset} canManage={!!can.qa_manage_runs} />
    </div>
  );
}
