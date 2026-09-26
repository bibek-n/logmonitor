import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSecurityUpdatesPermission, isSecurityUpdatesSession } from "@/lib/requireSecurityUpdatesPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { InstallError, deleteSchedule, setScheduleActive } from "@/lib/securityUpdates/installs";

const patchSchema = z.object({ isActive: z.boolean() });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const su = await requireSecurityUpdatesPermission("su_schedule");
  if (!isSecurityUpdatesSession(su)) return su;
  const id = Number((await ctx.params).id);
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  try {
    await setScheduleActive(id, parsed.data.isActive);
    await logAdminAction({ admin: su, section: "security-updates", action: parsed.data.isActive ? "schedule_resume" : "schedule_pause", details: `schedule #${id}`, req });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof InstallError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    return NextResponse.json({ ok: false, error: "Could not update the schedule" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const su = await requireSecurityUpdatesPermission("su_schedule");
  if (!isSecurityUpdatesSession(su)) return su;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  try {
    await deleteSchedule(id);
    await logAdminAction({ admin: su, section: "security-updates", action: "schedule_delete", details: `schedule #${id}`, req });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof InstallError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    return NextResponse.json({ ok: false, error: "Could not delete the schedule" }, { status: 500 });
  }
}
