import { getDb } from "@/lib/db";
import { getQaAccess } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { TraceabilityMatrixClient } from "@/components/qa/TraceabilityMatrixClient";

export const dynamic = "force-dynamic";

export default async function TraceabilityMatrixPage() {
  const { qa } = await getQaAccess();
  if (!qa) return <QaAccessDenied title="Traceability Matrix" />;

  const db = await getDb();
  const projects = await db.query<{ Id: number; Name: string }>`SELECT Id, Name FROM QaProjects WHERE IsActive = 1 ORDER BY Name ASC`;

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Requirement Traceability Matrix</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Every requirement, its linked test cases, and their latest execution result.
      </p>
      <TraceabilityMatrixClient projects={projects.recordset} />
    </div>
  );
}
