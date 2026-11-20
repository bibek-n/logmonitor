import { NextRequest, NextResponse } from "next/server";
import { requireOpsIncidentsPermission, isOpsIncidentsSession } from "@/lib/requireOpsIncidentsPermission";
import { linkAlertsToIncident } from "@/lib/opsIncidents/repository";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const oi = await requireOpsIncidentsPermission("oi_manage");
  if (!isOpsIncidentsSession(oi)) return oi;

  const { id } = await params;
  const incidentId = Number(id);
  if (!Number.isInteger(incidentId) || incidentId <= 0) return NextResponse.json({ ok: false, error: "Invalid incident id." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const alertIds = Array.isArray(body?.alertIds) ? body.alertIds.map((v: unknown) => Number(v)).filter((n: number) => Number.isInteger(n) && n > 0) : [];
  if (alertIds.length === 0) return NextResponse.json({ ok: false, error: "alertIds must be a non-empty array of positive integers." }, { status: 400 });

  await linkAlertsToIncident(incidentId, alertIds, oi);
  return NextResponse.json({ ok: true });
}
