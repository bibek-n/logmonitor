import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireServerRoomPermission, isServerRoomSession } from "@/lib/requireServerRoomPermission";
import { getIncident, updateIncident } from "@/lib/serverRoom/service";
import { fail } from "@/lib/serverRoom/http";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const sr = await requireServerRoomPermission("sr_view");
  if (!isServerRoomSession(sr)) return sr;
  const { number } = await params;
  try {
    const data = await getIncident(number);
    if (!data) return NextResponse.json({ ok: false, error: "Incident not found" }, { status: 404 });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return fail(err, "incident get");
  }
}

const bodySchema = z.object({
  status: z.string().max(20).optional(),
  severity: z.string().max(12).optional(),
  resolution: z.string().max(2000).nullish(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const sr = await requireServerRoomPermission("sr_incidents");
  if (!isServerRoomSession(sr)) return sr;
  const { number } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  try {
    await updateIncident(number, parsed.data, sr);
    await logAdminAction({ admin: sr, section: "server-room", action: "incident_updated", details: `${number}${parsed.data.status ? ` -> ${parsed.data.status}` : ""}`, req });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "incident update");
  }
}
