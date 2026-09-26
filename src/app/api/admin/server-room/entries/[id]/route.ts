import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireServerRoomPermission, isServerRoomSession } from "@/lib/requireServerRoomPermission";
import { updateEntry } from "@/lib/serverRoom/service";
import { INCIDENT_NUMBER_RE } from "@/lib/serverRoom/constants";
import { fail } from "@/lib/serverRoom/http";
import { logAdminAction } from "@/lib/adminAudit";

// action "exit" records the exit time (server clock) and optionally the Work Performed; without an action this
// just updates Work Performed / the linked Incident ID.
const bodySchema = z.object({
  action: z.literal("exit").optional(),
  workPerformed: z.string().max(2000).nullish(),
  incidentNumber: z.string().regex(INCIDENT_NUMBER_RE).nullish().or(z.literal("")),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sr = await requireServerRoomPermission("sr_record");
  if (!isServerRoomSession(sr)) return sr;
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid entry id" }, { status: 400 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  try {
    const b = parsed.data;
    await updateEntry(id, { action: b.action, workPerformed: b.workPerformed, incidentNumber: b.incidentNumber === undefined ? undefined : b.incidentNumber || null }, sr);
    await logAdminAction({ admin: sr, section: "server-room", action: b.action === "exit" ? "entry_exit" : "entry_updated", details: `entry ${id}`, req });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "server-room entry update");
  }
}
