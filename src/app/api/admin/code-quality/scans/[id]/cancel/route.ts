import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireCodeQualityPermission, isCqSession } from "@/lib/requireCodeQualityPermission";
import { logAdminAction } from "@/lib/adminAudit";

// Cooperative cancellation only: this flips the row to 'Cancelled', and runScan.ts's own
// executeScanInner polls CodeQualityScans.Status between files (every 25 files) to notice
// it - there is no separate process to kill, since the scan runs in-process inside this same
// Next.js server (see runScan.ts's architecture notes).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cq = await requireCodeQualityPermission("cq_scan_cancel");
  if (!isCqSession(cq)) return cq;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid scan id" }, { status: 400 });

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, id).query<{ Status: string }>("SELECT Status FROM CodeQualityScans WHERE Id = @id");
  const status = existing.recordset[0]?.Status;
  if (!status) return NextResponse.json({ ok: false, error: "Scan not found" }, { status: 404 });
  if (!["Pending", "Queued", "Running"].includes(status)) {
    return NextResponse.json({ ok: false, error: "Only a pending, queued, or running scan can be cancelled." }, { status: 400 });
  }

  await db.request().input("id", sql.Int, id).query("UPDATE CodeQualityScans SET Status = 'Cancelled' WHERE Id = @id");
  await logAdminAction({ admin: cq, section: "code-quality", action: "cancel_scan", details: `Scan #${id}`, req });

  return NextResponse.json({ ok: true });
}
