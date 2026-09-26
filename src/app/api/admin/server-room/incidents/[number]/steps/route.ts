import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireServerRoomPermission, isServerRoomSession } from "@/lib/requireServerRoomPermission";
import { addIncidentStep } from "@/lib/serverRoom/service";
import { fail } from "@/lib/serverRoom/http";
import { logAdminAction } from "@/lib/adminAudit";

const bodySchema = z.object({
  type: z.string().min(1).max(20),
  summary: z.string().min(1).max(1000),
  staffName: z.string().max(200).nullish(),
  deviceId: z.string().max(40).nullish(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const sr = await requireServerRoomPermission("sr_incidents");
  if (!isServerRoomSession(sr)) return sr;
  const { number } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Write what happened" }, { status: 400 });
  try {
    await addIncidentStep(number, { ...parsed.data, deviceId: parsed.data.deviceId || null, staffName: parsed.data.staffName ?? null }, sr);
    await logAdminAction({ admin: sr, section: "server-room", action: "incident_step_added", details: `${number}: ${parsed.data.type}`, req });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "incident step");
  }
}
