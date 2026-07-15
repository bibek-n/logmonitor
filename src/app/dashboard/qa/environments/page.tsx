import { getDb } from "@/lib/db";
import { getQaAccess } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { EnvironmentsClient } from "@/components/qa/EnvironmentsClient";

export const dynamic = "force-dynamic";

export default async function EnvironmentsPage() {
  const { qa, can } = await getQaAccess();
  if (!qa) return <QaAccessDenied title="Environments" />;

  const db = await getDb();
  const projects = await db.query<{ Id: number; Name: string }>`SELECT Id, Name FROM QaProjects WHERE IsActive = 1 ORDER BY Name ASC`;

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Environments</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        DEV/QA/UAT/STAGING/PRODUCTION-style environment references per project — descriptive only, no credentials.
      </p>
      <EnvironmentsClient projects={projects.recordset} canManage={!!(can.qa_create && can.qa_edit)} />
    </div>
  );
}
