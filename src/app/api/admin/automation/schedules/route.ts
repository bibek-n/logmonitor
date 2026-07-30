import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isAutomationSession, requireAutomationPermission } from "@/lib/requireAutomationPermission";
import { createScheduleSchema } from "@/lib/automation/schema";
import { createSchedule, getScript, listSchedules } from "@/lib/automation/repository";

export async function GET() {
  const automation = await requireAutomationPermission("auto_view");
  if (!isAutomationSession(automation)) return automation;

  const schedules = await listSchedules();
  return NextResponse.json({ ok: true, data: schedules });
}

export async function POST(req: NextRequest) {
  const automation = await requireAutomationPermission("auto_schedule_manage");
  if (!isAutomationSession(automation)) return automation;

  const body = await req.json().catch(() => null);
  const parsed = createScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid schedule payload" }, { status: 400 });
  }

  const script = await getScript(parsed.data.scriptId);
  if (!script) return NextResponse.json({ ok: false, error: "Script not found" }, { status: 404 });

  const id = await createSchedule(parsed.data, automation.userId);
  await logAdminAction({
    admin: automation,
    section: "automation",
    action: "schedule_create",
    details: `${parsed.data.name} (${script.name}, every ${parsed.data.intervalMinutes}m)`,
    req,
  });

  return NextResponse.json({ ok: true, data: { id } });
}
