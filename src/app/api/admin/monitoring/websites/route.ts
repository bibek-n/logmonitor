import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { createWebsiteMonitorSchema } from "@/lib/websiteApiMonitoring/schema";
import { listWebsiteMonitors, insertWebsiteMonitor } from "@/lib/websiteApiMonitoring/repository";

export async function GET() {
  const mon = await requireMonitoringPermission("mon_view");
  if (!isMonitoringSession(mon)) return mon;

  const monitors = await listWebsiteMonitors();
  return NextResponse.json({ ok: true, data: monitors });
}

export async function POST(req: NextRequest) {
  const mon = await requireMonitoringPermission("mon_website_create");
  if (!isMonitoringSession(mon)) return mon;

  const body = await req.json().catch(() => null);
  const parsed = createWebsiteMonitorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid monitor payload" }, { status: 400 });
  }
  const p = parsed.data;
  const monitorId = await insertWebsiteMonitor(p, mon.userId);

  await logAdminAction({ admin: mon, section: "monitoring", action: "website_monitor_create", details: `${p.name} (${p.url})`, req });

  return NextResponse.json({ ok: true, data: { id: monitorId } });
}
