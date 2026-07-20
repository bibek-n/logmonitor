import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireCodeQualityPermission, isCqSession } from "@/lib/requireCodeQualityPermission";
import { logAdminAction } from "@/lib/adminAudit";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cq = await requireCodeQualityPermission("cq_view");
  if (!isCqSession(cq)) return cq;

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) return NextResponse.json({ ok: false, error: "Invalid scan id" }, { status: 400 });

  const db = await getDb();
  const scanResult = await db.request().input("id", sql.Int, id).query(`
    SELECT
      s.Id, s.ProjectId, p.Name AS ProjectName, s.Branch, s.ScanType, s.Status,
      u.Username AS StartedByUsername,
      CONVERT(VARCHAR(19), s.StartedAt, 126) AS StartedAt,
      CONVERT(VARCHAR(19), s.CompletedAt, 126) AS CompletedAt,
      s.DurationMs, s.FilesScanned, s.LinesOfCode, s.QualityScore, s.ErrorMessage, s.ConfigSnapshot
    FROM CodeQualityScans s
    JOIN CodeQualityProjects p ON p.Id = s.ProjectId
    LEFT JOIN Users u ON u.Id = s.StartedByUserId
    WHERE s.Id = @id
  `);
  const scan = scanResult.recordset[0];
  if (!scan) return NextResponse.json({ ok: false, error: "Scan not found" }, { status: 404 });

  const issueCounts = await db.request().input("id", sql.Int, id).query(`
    SELECT Category, Severity, COUNT(*) AS Cnt
    FROM CodeQualityIssues WHERE ScanId = @id
    GROUP BY Category, Severity
  `);

  const metrics = await db.request().input("id", sql.Int, id).query(`
    SELECT MetricType, MetricName, Value, Threshold, AdditionalData
    FROM CodeQualityMetrics WHERE ScanId = @id
    ORDER BY MetricType, Value DESC
  `);

  return NextResponse.json({ ok: true, data: { ...scan, issueCounts: issueCounts.recordset, metrics: metrics.recordset } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cq = await requireCodeQualityPermission("cq_project_delete");
  if (!isCqSession(cq)) return cq;

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) return NextResponse.json({ ok: false, error: "Invalid scan id" }, { status: 400 });

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, id).query<{ Status: string }>("SELECT Status FROM CodeQualityScans WHERE Id = @id");
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Scan not found" }, { status: 404 });
  if (["Pending", "Queued", "Running"].includes(existing.recordset[0].Status)) {
    return NextResponse.json({ ok: false, error: "Cancel the scan before deleting its record." }, { status: 400 });
  }

  // Hard delete here (unlike the soft-delete convention used for Projects/Issues) - a scan
  // record's whole reason to exist is being a point-in-time result; CodeQualityIssues/
  // CodeQualityMetrics/CodeQualityScanLog cascade-delete with it (see the migration's FK
  // definitions), and nothing else references a scan row once it's gone.
  await db.request().input("id", sql.Int, id).query("DELETE FROM CodeQualityScans WHERE Id = @id");
  await logAdminAction({ admin: cq, section: "code-quality", action: "delete_scan", details: `Scan #${id}`, req });

  return NextResponse.json({ ok: true });
}
