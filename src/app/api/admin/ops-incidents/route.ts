import { NextRequest, NextResponse } from "next/server";
import { requireOpsIncidentsPermission, isOpsIncidentsSession } from "@/lib/requireOpsIncidentsPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { listIncidents, createIncident, INCIDENT_SEVERITIES, type IncidentSeverity } from "@/lib/opsIncidents/repository";

export async function GET(req: NextRequest) {
  const oi = await requireOpsIncidentsPermission("oi_view");
  if (!isOpsIncidentsSession(oi)) return oi;

  const p = req.nextUrl.searchParams;
  const status = p.get("status") ?? undefined;
  const severity = p.get("severity") ?? undefined;
  const ownerUserId = p.get("ownerUserId") ? Number(p.get("ownerUserId")) : undefined;

  const rows = await listIncidents({ status, severity, ownerUserId });
  return NextResponse.json({ ok: true, data: rows });
}

function parseIdArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);
}

// "Create incident from one or more alerts, or manually" - alertIds/monitorIncidentIds are
// both optional and independent; an incident with neither is a fully manual one.
export async function POST(req: NextRequest) {
  const oi = await requireOpsIncidentsPermission("oi_manage");
  if (!isOpsIncidentsSession(oi)) return oi;

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 300) : "";
  if (!title) return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });

  const severity = body?.severity as IncidentSeverity;
  if (!INCIDENT_SEVERITIES.includes(severity)) {
    return NextResponse.json({ ok: false, error: `severity must be one of: ${INCIDENT_SEVERITIES.join(", ")}` }, { status: 400 });
  }

  const affectedSystem = typeof body?.affectedSystem === "string" && body.affectedSystem.trim() ? body.affectedSystem.trim().slice(0, 300) : null;
  const ownerUserId = body?.ownerUserId === null || body?.ownerUserId === undefined ? null : Number(body.ownerUserId);
  const alertIds = parseIdArray(body?.alertIds);
  const monitorIncidentIds = parseIdArray(body?.monitorIncidentIds);

  const id = await createIncident({ title, severity, affectedSystem, ownerUserId, alertIds, monitorIncidentIds }, oi);
  await logAdminAction({ admin: oi, section: "ops-incidents", action: "incident_create", details: `#${id}: ${title}`, req });
  return NextResponse.json({ ok: true, data: { id } });
}
