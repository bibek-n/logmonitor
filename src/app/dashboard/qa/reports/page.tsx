import { getDb } from "@/lib/db";
import { getQaSession } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { ReportsClient } from "@/components/qa/ReportsClient";

export const dynamic = "force-dynamic";

export default async function QaReportsPage() {
  const qa = await getQaSession("qa_view_reports");
  if (!qa) return <QaAccessDenied title="QA Reports" />;

  const db = await getDb();
  const projects = await db.query<{ Id: number; Name: string }>`SELECT Id, Name FROM QaProjects WHERE IsActive = 1 ORDER BY Name ASC`;

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>QA Reports</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Pass rate, failure trends, bug health, and tester activity.
      </p>
      <ReportsClient projects={projects.recordset} />
    </div>
  );
}
