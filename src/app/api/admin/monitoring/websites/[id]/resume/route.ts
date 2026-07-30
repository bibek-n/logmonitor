import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { loadWebsiteMonitorById } from "@/lib/websiteApiMonitoring/repository";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_pause_resume");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const monitor = await loadWebsiteMonitorById(Number(id));
  if (!monitor) return NextResponse.json({ ok: false, error: "Monitor not found" }, { status: 404 });

  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, monitor.id)
    .query("UPDATE Monitors SET Status = 'Pending', ConsecutiveFailures = 0, ConsecutiveSuccesses = 0, NextCheckAt = SYSUTCDATETIME() WHERE Id = @id");

  await logAdminAction({ admin: mon, section: "monitoring", action: "website_monitor_resume", details: monitor.name, req });

  return NextResponse.json({ ok: true });
}
