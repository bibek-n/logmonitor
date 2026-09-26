import { NextRequest, NextResponse } from "next/server";
import { requireSecurityUpdatesPermission, isSecurityUpdatesSession } from "@/lib/requireSecurityUpdatesPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { InstallError, createSchedule, listSchedules, scheduleSchema } from "@/lib/securityUpdates/installs";

export async function GET() {
  const su = await requireSecurityUpdatesPermission("su_view");
  if (!isSecurityUpdatesSession(su)) return su;
  return NextResponse.json({ ok: true, data: await listSchedules() });
}

// Schedule Update. Including disruptive updates needs the explicit confirmation flag; it is recorded with the user.
export async function POST(req: NextRequest) {
  const su = await requireSecurityUpdatesPermission("su_schedule");
  if (!isSecurityUpdatesSession(su)) return su;
  const parsed = scheduleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Check the schedule: name, devices, update types and a date/time are required." }, { status: 400 });
  try {
    const id = await createSchedule(parsed.data, { userId: su.userId, username: su.username });
    await logAdminAction({
      admin: su,
      section: "security-updates",
      action: parsed.data.includeDisruptive ? "schedule_create_disruptive_confirmed" : "schedule_create",
      details: `schedule #${id} "${parsed.data.name}" ${parsed.data.recurrence}, ${parsed.data.deviceIds.length} device(s)`,
      req,
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    if (err instanceof InstallError) return NextResponse.json({ ok: false, error: err.message, ...(err.details as object | undefined) }, { status: (err.details as { confirmationRequired?: boolean } | undefined)?.confirmationRequired ? 200 : err.status });
    console.error("create schedule failed", err);
    return NextResponse.json({ ok: false, error: "Could not create the schedule" }, { status: 500 });
  }
}
