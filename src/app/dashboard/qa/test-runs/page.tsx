import { getDb } from "@/lib/db";
import { getQaAccess } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { TestRunsClient } from "@/components/qa/TestRunsClient";

export const dynamic = "force-dynamic";

export default async function TestRunsPage() {
  const { qa, can } = await getQaAccess();
  if (!qa) return <QaAccessDenied title="Test Runs" />;

  const db = await getDb();
  const [projects, releases, runTypes] = await Promise.all([
    db.query<{ Id: number; Name: string }>`SELECT Id, Name FROM QaProjects WHERE IsActive = 1 ORDER BY Name ASC`,
    db.query<{ Id: number; ProjectId: number; Name: string }>`SELECT Id, ProjectId, Name FROM QaReleases ORDER BY Name ASC`,
    db.query<{ Id: number; Name: string; Description: string | null }>`SELECT Id, Name, Description FROM QaTestRunTypes WHERE IsActive = 1 ORDER BY Id ASC`,
  ]);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Test Runs</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Plan and track execution rounds against a release.
      </p>
      <TestRunsClient projects={projects.recordset} releases={releases.recordset} runTypes={runTypes.recordset} canManage={!!can.qa_manage_runs} />
    </div>
  );
}
