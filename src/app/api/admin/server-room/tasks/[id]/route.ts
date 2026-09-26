import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireServerRoomPermission, isServerRoomSession } from "@/lib/requireServerRoomPermission";
import { updateTask } from "@/lib/serverRoom/service";
import { INCIDENT_NUMBER_RE } from "@/lib/serverRoom/constants";
import { fail } from "@/lib/serverRoom/http";
import { logAdminAction } from "@/lib/adminAudit";

const bodySchema = z.object({
  status: z.string().max(20).optional(),
  description: z.string().max(2000).optional(),
  incidentNumber: z.string().regex(INCIDENT_NUMBER_RE).nullish().or(z.literal("")),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sr = await requireServerRoomPermission("sr_record");
  if (!isServerRoomSession(sr)) return sr;
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  try {
    const b = parsed.data;
    await updateTask(id, { status: b.status, description: b.description, incidentNumber: b.incidentNumber === undefined ? undefined : b.incidentNumber || null }, sr);
    await logAdminAction({ admin: sr, section: "server-room", action: "task_updated", details: `task ${id}${b.status ? ` -> ${b.status}` : ""}`, req });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "server-room task update");
  }
}
