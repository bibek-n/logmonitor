import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireLaravelSecurityPermission, isLsSession } from "@/lib/requireLaravelSecurityPermission";
import { logAdminAction } from "@/lib/adminAudit";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ls = await requireLaravelSecurityPermission("ls_view");
  if (!isLsSession(ls)) return ls;

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
      s.DurationMs, s.FilesScanned, s.SecurityScore, s.ErrorMessage, s.ConfigSnapshot
    FROM LaravelSecurityScans s
    JOIN LaravelSecurityProjects p ON p.Id = s.ProjectId
    LEFT JOIN Users u ON u.Id = s.StartedByUserId
    WHERE s.Id = @id
  `);
  const scan = scanResult.recordset[0];
  if (!scan) return NextResponse.json({ ok: false, error: "Scan not found" }, { status: 404 });

  const issueCounts = await db.request().input("id", sql.Int, id).query(`
    SELECT Category, Severity, COUNT(*) AS Cnt
    FROM LaravelSecurityIssues WHERE ScanId = @id
    GROUP BY Category, Severity
  `);

  return NextResponse.json({ ok: true, data: { ...scan, issueCounts: issueCounts.recordset } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ls = await requireLaravelSecurityPermission("ls_project_delete");
  if (!isLsSession(ls)) return ls;

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) return NextResponse.json({ ok: false, error: "Invalid scan id" }, { status: 400 });

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, id).query<{ Status: string }>("SELECT Status FROM LaravelSecurityScans WHERE Id = @id");
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Scan not found" }, { status: 404 });
  if (["Pending", "Queued", "Running"].includes(existing.recordset[0].Status)) {
    return NextResponse.json({ ok: false, error: "Cancel the scan before deleting its record." }, { status: 400 });
  }

  // Hard delete, same reasoning as codeQuality/scans/[id]/route.ts: LaravelSecurityIssues/
  // LaravelSecurityScanLog cascade-delete with it via the migration's FK definitions.
  await db.request().input("id", sql.Int, id).query("DELETE FROM LaravelSecurityScans WHERE Id = @id");
  await logAdminAction({ admin: ls, section: "laravel-security", action: "delete_scan", details: `Scan #${id}`, req });

  return NextResponse.json({ ok: true });
}
