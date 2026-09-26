import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireServerRoomPermission, isServerRoomSession } from "@/lib/requireServerRoomPermission";
import { createEntry, listEntries } from "@/lib/serverRoom/service";
import { ENTRY_REASONS, INCIDENT_NUMBER_RE } from "@/lib/serverRoom/constants";
import { fail, pageParams, str } from "@/lib/serverRoom/http";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET(req: NextRequest) {
  const sr = await requireServerRoomPermission("sr_view");
  if (!isServerRoomSession(sr)) return sr;
  const p = req.nextUrl.searchParams;
  const status = p.get("status") ?? "";
  try {
    const result = await listEntries({
      from: str(p, "from", 10),
      to: str(p, "to", 10),
      staff: str(p, "staff"),
      reason: (ENTRY_REASONS as readonly string[]).includes(p.get("reason") ?? "") ? (p.get("reason") as string) : undefined,
      status: status === "active" || status === "completed" ? status : undefined,
      incident: str(p, "incident", 20),
      ...pageParams(p),
    });
    return NextResponse.json({ ok: true, data: result.rows, total: result.total });
  } catch (err) {
    return fail(err, "server-room entries list");
  }
}

// Staff Name + Reason/Task + Work Performed. Entry time is set by the server clock; exit is a separate action.
const bodySchema = z.object({
  staffId: z.number().int().positive(),
  reason: z.string().min(1).max(40),
  workPerformed: z.string().max(2000).nullish(),
  incidentNumber: z.string().regex(INCIDENT_NUMBER_RE).nullish(),
});

export async function POST(req: NextRequest) {
  const sr = await requireServerRoomPermission("sr_record");
  if (!isServerRoomSession(sr)) return sr;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Choose a staff member and a reason" }, { status: 400 });
  try {
    const id = await createEntry({ ...parsed.data, workPerformed: parsed.data.workPerformed ?? null, incidentNumber: parsed.data.incidentNumber ?? null }, sr);
    await logAdminAction({ admin: sr, section: "server-room", action: "entry_created", details: `entry ${id}`, req });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return fail(err, "server-room entry create");
  }
}
