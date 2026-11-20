import { NextRequest, NextResponse } from "next/server";
import { requireOpsIncidentsPermission, isOpsIncidentsSession } from "@/lib/requireOpsIncidentsPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { resolveIncident } from "@/lib/opsIncidents/repository";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const oi = await requireOpsIncidentsPermission("oi_manage");
  if (!isOpsIncidentsSession(oi)) return oi;

  const { id } = await params;
  const incidentId = Number(id);
  if (!Number.isInteger(incidentId) || incidentId <= 0) return NextResponse.json({ ok: false, error: "Invalid incident id." }, { status: 400 });

  await resolveIncident(incidentId, oi);
  await logAdminAction({ admin: oi, section: "ops-incidents", action: "incident_resolve", details: `#${incidentId}`, req });
  return NextResponse.json({ ok: true });
}
