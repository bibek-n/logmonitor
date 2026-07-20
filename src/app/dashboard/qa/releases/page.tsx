import { getDb } from "@/lib/db";
import { getQaAccess } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { ReleasesClient } from "@/components/qa/ReleasesClient";

export const dynamic = "force-dynamic";

export default async function ReleasesPage() {
  const { qa, can } = await getQaAccess();
  if (!qa) return <QaAccessDenied title="Releases" />;

  const db = await getDb();
  const [projects, releases] = await Promise.all([
    db.query<{ Id: number; Name: string }>`SELECT Id, Name FROM QaProjects WHERE IsActive = 1 ORDER BY Name ASC`,
    db.query<{
      Id: number; ProjectId: number; Name: string; ReleaseDate: string | null; Status: string;
      ReleasedByUserId: number | null; ReleasedAt: string | null; CreatedAt: string;
    }>`
      SELECT r.Id, r.ProjectId, r.Name, CONVERT(VARCHAR(10), r.ReleaseDate, 126) AS ReleaseDate, r.Status,
        r.ReleasedByUserId, CONVERT(VARCHAR(19), r.ReleasedAt, 126) AS ReleasedAt,
        CONVERT(VARCHAR(19), r.CreatedAt, 126) AS CreatedAt
      FROM QaReleases r ORDER BY r.ReleaseDate DESC, r.Name ASC
    `,
  ]);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Releases</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Production releases and the QA-approved test runs behind each one.
      </p>
      <ReleasesClient projects={projects.recordset} releases={releases.recordset} canManage={!!can.qa_manage_runs} />
    </div>
  );
}
