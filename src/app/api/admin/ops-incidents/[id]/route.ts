import { NextRequest, NextResponse } from "next/server";
import { requireOpsIncidentsPermission, isOpsIncidentsSession } from "@/lib/requireOpsIncidentsPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { getIncidentDetail, updateIncidentFields, INCIDENT_SEVERITIES, INCIDENT_STATUSES, type IncidentSeverity, type IncidentStatus } from "@/lib/opsIncidents/repository";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const oi = await requireOpsIncidentsPermission("oi_view");
  if (!isOpsIncidentsSession(oi)) return oi;

  const { id } = await params;
  const incidentId = Number(id);
  if (!Number.isInteger(incidentId) || incidentId <= 0) return NextResponse.json({ ok: false, error: "Invalid incident id." }, { status: 400 });

  const detail = await getIncidentDetail(incidentId);
  if (!detail) return NextResponse.json({ ok: false, error: "Incident not found." }, { status: 404 });
  return NextResponse.json({ ok: true, data: detail });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const oi = await requireOpsIncidentsPermission("oi_manage");
  if (!isOpsIncidentsSession(oi)) return oi;

  const { id } = await params;
  const incidentId = Number(id);
  if (!Number.isInteger(incidentId) || incidentId <= 0) return NextResponse.json({ ok: false, error: "Invalid incident id." }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });

  const patch: Parameters<typeof updateIncidentFields>[1] = {};
  if ("title" in body) {
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 300) : "";
    if (!title) return NextResponse.json({ ok: false, error: "Title cannot be empty." }, { status: 400 });
    patch.title = title;
  }
  if ("severity" in body) {
    const severity = body.severity as IncidentSeverity;
    if (!INCIDENT_SEVERITIES.includes(severity)) return NextResponse.json({ ok: false, error: "Invalid severity." }, { status: 400 });
    patch.severity = severity;
  }
  if ("affectedSystem" in body) patch.affectedSystem = typeof body.affectedSystem === "string" && body.affectedSystem.trim() ? body.affectedSystem.trim().slice(0, 300) : null;
  if ("status" in body) {
    const status = body.status as IncidentStatus;
    if (!INCIDENT_STATUSES.includes(status)) return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 400 });
    patch.status = status;
  }
  if ("ownerUserId" in body) patch.ownerUserId = body.ownerUserId === null ? null : Number(body.ownerUserId);
  if ("rootCause" in body) patch.rootCause = typeof body.rootCause === "string" ? body.rootCause.slice(0, 8000) : null;
  if ("fix" in body) patch.fix = typeof body.fix === "string" ? body.fix.slice(0, 8000) : null;
  if ("prevention" in body) patch.prevention = typeof body.prevention === "string" ? body.prevention.slice(0, 8000) : null;

  try {
    await updateIncidentFields(incidentId, patch, oi);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Update failed." }, { status: 404 });
  }

  await logAdminAction({ admin: oi, section: "ops-incidents", action: "incident_update", details: `#${incidentId}: ${Object.keys(patch).join(", ")}`, req });
  const detail = await getIncidentDetail(incidentId);
  return NextResponse.json({ ok: true, data: detail });
}
