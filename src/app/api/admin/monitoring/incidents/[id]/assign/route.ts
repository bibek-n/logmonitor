import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { assignIncidentSchema } from "@/lib/websiteApiMonitoring/schema";
import { assignIncident } from "@/lib/websiteApiMonitoring/incidentService";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_incidents_manage");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = assignIncidentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid assignment payload" }, { status: 400 });
  }

  await assignIncident(Number(id), parsed.data.userId);

  await logAdminAction({ admin: mon, section: "monitoring", action: "incident_assign", details: `Incident #${id} -> user ${parsed.data.userId ?? "unassigned"}`, req });

  return NextResponse.json({ ok: true });
}
