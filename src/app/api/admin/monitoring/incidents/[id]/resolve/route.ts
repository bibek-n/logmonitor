import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { resolveIncidentSchema } from "@/lib/websiteApiMonitoring/schema";
import { manualResolveIncident } from "@/lib/websiteApiMonitoring/incidentService";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_incidents_manage");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = resolveIncidentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid resolve payload" }, { status: 400 });
  }

  await manualResolveIncident(Number(id), mon.userId, parsed.data.note ?? null);

  await logAdminAction({ admin: mon, section: "monitoring", action: "incident_manual_resolve", details: `Incident #${id}`, req });

  return NextResponse.json({ ok: true });
}
