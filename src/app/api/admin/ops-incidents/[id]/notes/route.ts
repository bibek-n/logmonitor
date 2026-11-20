import { NextRequest, NextResponse } from "next/server";
import { requireOpsIncidentsPermission, isOpsIncidentsSession } from "@/lib/requireOpsIncidentsPermission";
import { addManualNote } from "@/lib/opsIncidents/repository";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const oi = await requireOpsIncidentsPermission("oi_manage");
  if (!isOpsIncidentsSession(oi)) return oi;

  const { id } = await params;
  const incidentId = Number(id);
  if (!Number.isInteger(incidentId) || incidentId <= 0) return NextResponse.json({ ok: false, error: "Invalid incident id." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 2000) : "";
  if (!note) return NextResponse.json({ ok: false, error: "Note is required." }, { status: 400 });

  await addManualNote(incidentId, note, oi);
  return NextResponse.json({ ok: true });
}
