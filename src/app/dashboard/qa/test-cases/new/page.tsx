import { getDb } from "@/lib/db";
import { getQaSession } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { NewTestCaseForm } from "@/components/qa/NewTestCaseForm";

export const dynamic = "force-dynamic";

export default async function NewTestCasePage({
  searchParams,
}: {
  searchParams: Promise<{ testSuiteId?: string }>;
}) {
  const qa = await getQaSession("qa_create");
  if (!qa) return <QaAccessDenied title="New Test Case" />;

  const sp = await searchParams;
  const db = await getDb();
  const [projects, suites, runTypes] = await Promise.all([
    db.query<{ Id: number; Name: string }>`SELECT Id, Name FROM QaProjects WHERE IsActive = 1 ORDER BY Name ASC`,
    db.query<{ Id: number; ProjectId: number; ModuleId: number | null; Name: string }>`
      SELECT Id, ProjectId, ModuleId, Name FROM QaTestSuites WHERE Status <> 'Archived' ORDER BY Name ASC
    `,
    db.query<{ Id: number; Name: string }>`SELECT Id, Name FROM QaTestRunTypes WHERE IsActive = 1 ORDER BY Id ASC`,
  ]);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>New Test Case</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Define the case, its steps, and expected result.
      </p>
      <NewTestCaseForm
        projects={projects.recordset}
        suites={suites.recordset}
        runTypes={runTypes.recordset}
        initialTestSuiteId={sp.testSuiteId ? Number(sp.testSuiteId) : null}
      />
    </div>
  );
}
