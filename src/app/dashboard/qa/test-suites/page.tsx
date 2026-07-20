import { getDb } from "@/lib/db";
import { getQaAccess } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { TestSuitesClient } from "@/components/qa/TestSuitesClient";

export const dynamic = "force-dynamic";

export default async function TestSuitesPage() {
  const { qa, can } = await getQaAccess();
  if (!qa) return <QaAccessDenied title="Test Suites" />;

  const db = await getDb();
  const [projects, modules] = await Promise.all([
    db.query<{ Id: number; Name: string }>`SELECT Id, Name FROM QaProjects WHERE IsActive = 1 ORDER BY Name ASC`,
    db.query<{ Id: number; ProjectId: number; Name: string }>`SELECT Id, ProjectId, Name FROM QaModules ORDER BY Name ASC`,
  ]);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Test Suites</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Group related test cases into suites for a project or module.
      </p>
      <TestSuitesClient projects={projects.recordset} modules={modules.recordset} canCreate={!!can.qa_create} canDelete={!!can.qa_delete} />
    </div>
  );
}
