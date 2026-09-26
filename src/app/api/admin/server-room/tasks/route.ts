import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireServerRoomPermission, isServerRoomSession } from "@/lib/requireServerRoomPermission";
import { createTask, listTasks } from "@/lib/serverRoom/service";
import { INCIDENT_NUMBER_RE, TASK_GROUPS, TASK_STATUSES } from "@/lib/serverRoom/constants";
import { fail, pageParams, str } from "@/lib/serverRoom/http";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET(req: NextRequest) {
  const sr = await requireServerRoomPermission("sr_view");
  if (!isServerRoomSession(sr)) return sr;
  const p = req.nextUrl.searchParams;
  try {
    const result = await listTasks({
      from: str(p, "from", 10),
      to: str(p, "to", 10),
      staff: str(p, "staff"),
      group: (TASK_GROUPS as readonly string[]).includes(p.get("group") ?? "") ? (p.get("group") as string) : undefined,
      type: str(p, "type", 80),
      status: (TASK_STATUSES as readonly string[]).includes(p.get("status") ?? "") ? (p.get("status") as string) : undefined,
      device: str(p, "device"),
      incident: str(p, "incident", 20),
      ...pageParams(p),
    });
    return NextResponse.json({ ok: true, data: result.rows, total: result.total });
  } catch (err) {
    return fail(err, "server-room tasks list");
  }
}

const bodySchema = z.object({
  staffId: z.number().int().positive(),
  group: z.string().min(1).max(30),
  type: z.string().min(1).max(80),
  deviceId: z.string().max(40).nullish(),
  deviceLabel: z.string().max(200).nullish(),
  description: z.string().min(1).max(2000),
  entryId: z.number().int().positive().nullish(),
  incidentNumber: z.string().regex(INCIDENT_NUMBER_RE).nullish(),
  status: z.string().max(20).optional(),
});

export async function POST(req: NextRequest) {
  const sr = await requireServerRoomPermission("sr_record");
  if (!isServerRoomSession(sr)) return sr;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Fill in staff, task type and a description of the work" }, { status: 400 });
  try {
    const b = parsed.data;
    const id = await createTask({ ...b, deviceId: b.deviceId || null, deviceLabel: b.deviceLabel ?? null, entryId: b.entryId ?? null, incidentNumber: b.incidentNumber ?? null }, sr);
    await logAdminAction({ admin: sr, section: "server-room", action: "task_created", details: `task ${id}: ${b.group} / ${b.type}`, req });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return fail(err, "server-room task create");
  }
}
