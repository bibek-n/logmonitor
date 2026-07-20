import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getQaAccess } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { ReleaseDetailClient } from "@/components/qa/ReleaseDetailClient";

export const dynamic = "force-dynamic";

interface ReleaseDetail {
  Id: number;
  ProjectId: number;
  Name: string;
  ReleaseDate: string | null;
  Status: string;
  ReleasedByUserId: number | null;
  ReleasedAt: string | null;
  CreatedAt: string;
}

interface LinkedRunRow {
  Id: number;
  TestRunNumber: string;
  Name: string;
  Status: string;
  QaApprovedAt: string | null;
}

export default async function ReleaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { qa, can } = await getQaAccess();
  if (!qa) return <QaAccessDenied title="Release" />;

  const { id } = await params;
  const releaseId = Number(id);
  if (!Number.isInteger(releaseId)) notFound();

  const db = await getDb();
  const releaseResult = await db.request().input("id", sql.Int, releaseId).query<ReleaseDetail>(`
    SELECT Id, ProjectId, Name, CONVERT(VARCHAR(10), ReleaseDate, 126) AS ReleaseDate, Status,
      ReleasedByUserId, CONVERT(VARCHAR(19), ReleasedAt, 126) AS ReleasedAt,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
    FROM QaReleases WHERE Id = @id
  `);
  const release = releaseResult.recordset[0];
  if (!release) notFound();

  const [projectResult, linkedRuns, releasedByResult] = await Promise.all([
    db.request().input("id", sql.Int, release.ProjectId).query<{ Name: string }>("SELECT Name FROM QaProjects WHERE Id = @id"),
    db.request().input("id", sql.Int, releaseId).query<LinkedRunRow>(`
      SELECT Id, TestRunNumber, Name, Status, CONVERT(VARCHAR(19), QaApprovedAt, 126) AS QaApprovedAt
      FROM QaTestRuns WHERE ReleaseId = @id ORDER BY CreatedAt DESC
    `),
    release.ReleasedByUserId
      ? db.request().input("id", sql.Int, release.ReleasedByUserId).query<{ Username: string }>("SELECT Username FROM Users WHERE Id = @id")
      : Promise.resolve({ recordset: [] as { Username: string }[] }),
  ]);

  return (
    <ReleaseDetailClient
      release={release}
      projectName={projectResult.recordset[0]?.Name ?? "—"}
      testRuns={linkedRuns.recordset}
      releasedByUsername={releasedByResult.recordset[0]?.Username ?? null}
      canManage={!!can.qa_manage_runs}
    />
  );
}
