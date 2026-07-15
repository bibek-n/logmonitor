import { getDb } from "@/lib/db";
import { getQaAccess } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { BuildsClient } from "@/components/qa/BuildsClient";

export const dynamic = "force-dynamic";

export default async function BuildsPage() {
  const { qa, can } = await getQaAccess();
  if (!qa) return <QaAccessDenied title="Builds" />;

  const db = await getDb();
  const [projects, environments, releases] = await Promise.all([
    db.query<{ Id: number; Name: string }>`SELECT Id, Name FROM QaProjects WHERE IsActive = 1 ORDER BY Name ASC`,
    db.query<{ Id: number; ProjectId: number; Name: string }>`SELECT Id, ProjectId, Name FROM QaEnvironments WHERE IsActive = 1 ORDER BY Name ASC`,
    db.query<{ Id: number; ProjectId: number; Name: string }>`SELECT Id, ProjectId, Name FROM QaReleases ORDER BY Name ASC`,
  ]);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Builds</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Track build numbers, commits, and deployment status per project.
      </p>
      <BuildsClient
        projects={projects.recordset}
        environments={environments.recordset}
        releases={releases.recordset}
        canManage={!!(can.qa_create && can.qa_edit)}
      />
    </div>
  );
}
