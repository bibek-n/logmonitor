import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { resolveIncidentSchema } from "@/lib/websiteApiMonitoring/schema";
import { reopenIncident } from "@/lib/websiteApiMonitoring/incidentService";

// Reuses resolveIncidentSchema's { note? } shape - reopen takes exactly the same optional
// free-text note as manual-resolve, no separate schema needed for one shared field.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_incidents_manage");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = resolveIncidentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid reopen payload" }, { status: 400 });
  }

  await reopenIncident(Number(id), mon.userId, parsed.data.note ?? null);

  await logAdminAction({ admin: mon, section: "monitoring", action: "incident_reopen", details: `Incident #${id}`, req });

  return NextResponse.json({ ok: true });
}
