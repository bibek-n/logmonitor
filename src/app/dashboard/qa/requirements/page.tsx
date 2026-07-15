import { getDb } from "@/lib/db";
import { getQaAccess } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { RequirementsClient } from "@/components/qa/RequirementsClient";

export const dynamic = "force-dynamic";

export default async function RequirementsPage() {
  const { qa, can } = await getQaAccess();
  if (!qa) return <QaAccessDenied title="Requirements" />;

  const db = await getDb();
  const projects = await db.query<{ Id: number; Name: string }>`SELECT Id, Name FROM QaProjects WHERE IsActive = 1 ORDER BY Name ASC`;

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Requirements</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Track requirements and link them to the test cases that cover them.
      </p>
      <RequirementsClient projects={projects.recordset} canManage={!!can.qa_create} />
    </div>
  );
}
