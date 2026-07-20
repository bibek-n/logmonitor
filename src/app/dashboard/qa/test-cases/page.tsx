import { getDb } from "@/lib/db";
import { getQaAccess } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { TestCasesClient } from "@/components/qa/TestCasesClient";

export const dynamic = "force-dynamic";

export default async function TestCasesPage({
  searchParams,
}: {
  searchParams: Promise<{ testSuiteId?: string; projectId?: string }>;
}) {
  const { qa, can } = await getQaAccess();
  if (!qa) return <QaAccessDenied title="Test Cases" />;

  const sp = await searchParams;
  const db = await getDb();
  const [projects, suites] = await Promise.all([
    db.query<{ Id: number; Name: string }>`SELECT Id, Name FROM QaProjects WHERE IsActive = 1 ORDER BY Name ASC`,
    db.query<{ Id: number; ProjectId: number; Name: string }>`SELECT Id, ProjectId, Name FROM QaTestSuites WHERE Status <> 'Archived' ORDER BY Name ASC`,
  ]);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Test Cases</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Search, filter, import, and export test cases across every suite.
      </p>
      <TestCasesClient
        projects={projects.recordset}
        suites={suites.recordset}
        initialTestSuiteId={sp.testSuiteId ? Number(sp.testSuiteId) : null}
        initialProjectId={sp.projectId ? Number(sp.projectId) : null}
        canCreate={!!can.qa_create}
        canEdit={!!can.qa_edit}
        canDelete={!!can.qa_delete}
      />
    </div>
  );
}
