import { NextRequest, NextResponse } from "next/server";
import { requireOpsIncidentsPermission, isOpsIncidentsSession } from "@/lib/requireOpsIncidentsPermission";
import { getIncidentDetail } from "@/lib/opsIncidents/repository";
import { suggestKbArticles } from "@/lib/opsIncidents/kbSuggestions";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const oi = await requireOpsIncidentsPermission("oi_view");
  if (!isOpsIncidentsSession(oi)) return oi;

  const { id } = await params;
  const incidentId = Number(id);
  if (!Number.isInteger(incidentId) || incidentId <= 0) return NextResponse.json({ ok: false, error: "Invalid incident id." }, { status: 400 });

  const incident = await getIncidentDetail(incidentId);
  if (!incident) return NextResponse.json({ ok: false, error: "Incident not found." }, { status: 404 });

  const suggestions = await suggestKbArticles(incident.title, incident.affectedSystem);
  return NextResponse.json({ ok: true, data: suggestions });
}
