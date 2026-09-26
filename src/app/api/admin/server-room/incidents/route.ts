import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireServerRoomPermission, isServerRoomSession } from "@/lib/requireServerRoomPermission";
import { createIncident, listIncidents } from "@/lib/serverRoom/service";
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES } from "@/lib/serverRoom/constants";
import { fail, pageParams, str } from "@/lib/serverRoom/http";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET(req: NextRequest) {
  const sr = await requireServerRoomPermission("sr_view");
  if (!isServerRoomSession(sr)) return sr;
  const p = req.nextUrl.searchParams;
  const status = p.get("status") ?? "";
  try {
    const result = await listIncidents({
      status: status === "open" || (INCIDENT_STATUSES as readonly string[]).includes(status) ? status : undefined,
      severity: (INCIDENT_SEVERITIES as readonly string[]).includes(p.get("severity") ?? "") ? (p.get("severity") as string) : undefined,
      q: str(p, "q"),
      ...pageParams(p),
    });
    return NextResponse.json({ ok: true, data: result.rows, total: result.total });
  } catch (err) {
    return fail(err, "incidents list");
  }
}

const bodySchema = z.object({
  title: z.string().min(1).max(300),
  severity: z.string().max(12).optional(),
  description: z.string().max(2000).nullish(),
  deviceId: z.string().max(40).nullish(),
  updateKeys: z.array(z.string().max(300)).max(100).optional(),
  staffName: z.string().max(200).nullish(),
});

export async function POST(req: NextRequest) {
  const sr = await requireServerRoomPermission("sr_incidents");
  if (!isServerRoomSession(sr)) return sr;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Give the incident a title" }, { status: 400 });
  try {
    const b = parsed.data;
    const number = await createIncident({ ...b, description: b.description ?? null, deviceId: b.deviceId || null, staffName: b.staffName ?? null }, sr);
    await logAdminAction({ admin: sr, section: "server-room", action: "incident_created", details: `${number}: ${b.title}`, req });
    return NextResponse.json({ ok: true, number });
  } catch (err) {
    return fail(err, "incident create");
  }
}
