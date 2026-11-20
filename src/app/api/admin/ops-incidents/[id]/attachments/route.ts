import { NextRequest, NextResponse } from "next/server";
import { requireOpsIncidentsPermission, isOpsIncidentsSession } from "@/lib/requireOpsIncidentsPermission";
import { validateIncidentAttachment, saveIncidentAttachment } from "@/lib/opsIncidents/attachments";
import { addAttachment } from "@/lib/opsIncidents/repository";

// multipart/form-data: file (required).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const oi = await requireOpsIncidentsPermission("oi_manage");
  if (!isOpsIncidentsSession(oi)) return oi;

  const { id } = await params;
  const incidentId = Number(id);
  if (!Number.isInteger(incidentId) || incidentId <= 0) return NextResponse.json({ ok: false, error: "Invalid incident id." }, { status: 400 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ ok: false, error: "Invalid form submission." }, { status: 400 });

  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "A file is required." }, { status: 400 });

  const validation = validateIncidentAttachment(file.name, file.size);
  if (!validation.ok) return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = await saveIncidentAttachment(buffer, file.name);

  const attachmentId = await addAttachment(incidentId, { filePath, originalFileName: file.name, contentType: file.type || null, sizeBytes: file.size }, oi);
  return NextResponse.json({ ok: true, data: { id: attachmentId } });
}
