import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireLaravelSecurityPermission, isLsSession } from "@/lib/requireLaravelSecurityPermission";
import { logAdminAction } from "@/lib/adminAudit";

// Cooperative cancellation only - runScan.ts's executeScanInner polls LaravelSecurityScans.
// Status between files (every 25 files) to notice this, same mechanism as codeQuality's own
// scans/[id]/cancel/route.ts.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ls = await requireLaravelSecurityPermission("ls_scan_cancel");
  if (!isLsSession(ls)) return ls;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid scan id" }, { status: 400 });

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, id).query<{ Status: string }>("SELECT Status FROM LaravelSecurityScans WHERE Id = @id");
  const status = existing.recordset[0]?.Status;
  if (!status) return NextResponse.json({ ok: false, error: "Scan not found" }, { status: 404 });
  if (!["Pending", "Queued", "Running"].includes(status)) {
    return NextResponse.json({ ok: false, error: "Only a pending, queued, or running scan can be cancelled." }, { status: 400 });
  }

  await db.request().input("id", sql.Int, id).query("UPDATE LaravelSecurityScans SET Status = 'Cancelled' WHERE Id = @id");
  await logAdminAction({ admin: ls, section: "laravel-security", action: "cancel_scan", details: `Scan #${id}`, req });

  return NextResponse.json({ ok: true });
}
