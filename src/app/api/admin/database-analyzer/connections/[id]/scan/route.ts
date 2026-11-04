import { NextRequest, NextResponse } from "next/server";
import { requireDbAnalyzerPermission, isDbAnalyzerSession } from "@/lib/requireDbAnalyzerPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { runScan } from "@/lib/dbAnalyzer/runScan";

// Synchronous - schema introspection (catalog-only metadata queries, no row data) completes
// in a few seconds even for a fairly large database, unlike the website/WordPress scanners'
// multi-minute crawls, so there's no need for the fire-and-forget + progress-poll pattern
// those use.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireDbAnalyzerPermission("dba_scan");
  if (!isDbAnalyzerSession(admin)) return admin;

  const { id } = await params;
  const connectionId = Number(id);
  if (!Number.isInteger(connectionId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  try {
    const summary = await runScan(connectionId, admin.userId, admin.username);
    await logAdminAction({
      admin,
      section: "database_analyzer",
      action: "run_scan",
      details: `connectionId=${connectionId} — score ${summary.securityScore}, risk ${summary.riskLevel}`,
      req,
    });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Scan failed." });
  }
}
