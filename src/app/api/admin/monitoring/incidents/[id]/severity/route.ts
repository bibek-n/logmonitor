import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { changeIncidentSeveritySchema } from "@/lib/websiteApiMonitoring/schema";
import { changeIncidentSeverity } from "@/lib/websiteApiMonitoring/incidentService";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_incidents_manage");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = changeIncidentSeveritySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid severity payload" }, { status: 400 });
  }

  await changeIncidentSeverity(Number(id), parsed.data.severity);

  await logAdminAction({ admin: mon, section: "monitoring", action: "incident_severity_change", details: `Incident #${id} -> ${parsed.data.severity}`, req });

  return NextResponse.json({ ok: true });
}
