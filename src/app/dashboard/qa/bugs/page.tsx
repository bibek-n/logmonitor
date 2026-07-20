import { getDb } from "@/lib/db";
import { getQaAccess } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { BugsClient } from "@/components/qa/BugsClient";

export const dynamic = "force-dynamic";

export default async function BugsPage({
  searchParams,
}: {
  searchParams: Promise<{ testCaseId?: string; projectId?: string; testRunId?: string }>;
}) {
  const { qa, can } = await getQaAccess();
  if (!qa) return <QaAccessDenied title="Bugs" />;

  const sp = await searchParams;
  const db = await getDb();
  const [projects, users] = await Promise.all([
    db.query<{ Id: number; Name: string }>`SELECT Id, Name FROM QaProjects WHERE IsActive = 1 ORDER BY Name ASC`,
    db.query<{ Id: number; Username: string }>`SELECT Id, Username FROM Users ORDER BY Username ASC`,
  ]);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Bugs</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Track defects from filing through resolution and retest.
      </p>
      <BugsClient
        projects={projects.recordset}
        users={users.recordset}
        prefill={sp.testCaseId ? { testCaseId: Number(sp.testCaseId), projectId: sp.projectId ? Number(sp.projectId) : null, testRunId: sp.testRunId ? Number(sp.testRunId) : null } : null}
        canCreate={!!can.qa_manage_bugs}
      />
    </div>
  );
}
