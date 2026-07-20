import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { VALID_RELEASE_STATUSES, type QaReleaseRow } from "@/lib/qaShared";

interface LinkedRunRow {
  Id: number;
  TestRunNumber: string;
  Name: string;
  Status: string;
  QaApprovedAt: string | null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const releaseId = Number(id);
  if (!Number.isInteger(releaseId)) {
    return NextResponse.json({ ok: false, error: "Invalid release id." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, releaseId).query<QaReleaseRow>(`
    SELECT Id, ProjectId, Name, CONVERT(VARCHAR(10), ReleaseDate, 126) AS ReleaseDate, Status,
      ReleasedByUserId, CONVERT(VARCHAR(19), ReleasedAt, 126) AS ReleasedAt,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
    FROM QaReleases WHERE Id = @id
  `);
  const release = result.recordset[0];
  if (!release) {
    return NextResponse.json({ ok: false, error: "Release not found." }, { status: 404 });
  }

  const linkedRuns = await db.request().input("id", sql.Int, releaseId).query<LinkedRunRow>(`
    SELECT Id, TestRunNumber, Name, Status, CONVERT(VARCHAR(19), QaApprovedAt, 126) AS QaApprovedAt
    FROM QaTestRuns WHERE ReleaseId = @id ORDER BY CreatedAt DESC
  `);

  return NextResponse.json({ ok: true, data: { ...release, testRuns: linkedRuns.recordset } });
}

// "Production Release" step: marking Status='Released' requires at least one test run linked
// to this release to be both Completed and QA-approved — a release with nothing behind it, or
// only unapproved runs, can't be released through this route. Every other status transition
// (Planned/In Progress/Cancelled) has no gate.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_manage_runs");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const releaseId = Number(id);
  if (!Number.isInteger(releaseId)) {
    return NextResponse.json({ ok: false, error: "Invalid release id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const db = await getDb();

  const existingResult = await db.request().input("id", sql.Int, releaseId).query<QaReleaseRow>(
    "SELECT * FROM QaReleases WHERE Id = @id"
  );
  const existing = existingResult.recordset[0];
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Release not found." }, { status: 404 });
  }

  const status = typeof body?.status === "string" && VALID_RELEASE_STATUSES.has(body.status) ? body.status : existing.Status;
  const releasingNow = status === "Released" && existing.Status !== "Released";

  if (releasingNow) {
    const approvedRuns = await db.request().input("id", sql.Int, releaseId).query<{ Cnt: number }>(`
      SELECT COUNT(*) AS Cnt FROM QaTestRuns
      WHERE ReleaseId = @id AND Status = 'Completed' AND QaApprovedAt IS NOT NULL
    `);
    if ((approvedRuns.recordset[0]?.Cnt ?? 0) === 0) {
      return NextResponse.json(
        { ok: false, error: "Cannot release: no QA-approved, completed test run is linked to this release yet." },
        { status: 400 }
      );
    }
  }

  const updateRequest = db.request().input("id", sql.Int, releaseId).input("status", sql.VarChar, status);
  let setClause = "Status = @status";
  if (releasingNow) {
    updateRequest.input("releasedByUserId", sql.Int, qa.userId);
    setClause += ", ReleasedByUserId = @releasedByUserId, ReleasedAt = SYSUTCDATETIME()";
  }
  await updateRequest.query(`UPDATE QaReleases SET ${setClause} WHERE Id = @id`);

  await logAdminAction({ admin: qa, section: "qa", action: releasingNow ? "release_qa_release" : "update_release", details: `${existing.Name} -> ${status}`, req });
  await logQaActivity({
    entityType: "Release", entityId: releaseId, action: releasingNow ? "release" : "update",
    userId: qa.userId, previousValue: { Status: existing.Status }, newValue: { Status: status }, req,
  });

  return NextResponse.json({ ok: true });
}
