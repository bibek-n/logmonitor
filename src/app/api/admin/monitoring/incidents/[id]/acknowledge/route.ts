import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { acknowledgeIncident } from "@/lib/websiteApiMonitoring/incidentService";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_incidents_manage");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  await acknowledgeIncident(Number(id), mon.userId);

  await logAdminAction({ admin: mon, section: "monitoring", action: "incident_acknowledge", details: `Incident #${id}`, req });

  return NextResponse.json({ ok: true });
}
