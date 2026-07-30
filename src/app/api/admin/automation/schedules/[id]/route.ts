import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isAutomationSession, requireAutomationPermission } from "@/lib/requireAutomationPermission";
import { updateScheduleSchema } from "@/lib/automation/schema";
import { deleteSchedule, getSchedule, updateSchedule } from "@/lib/automation/repository";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const automation = await requireAutomationPermission("auto_view");
  if (!isAutomationSession(automation)) return automation;

  const { id } = await params;
  const schedule = await getSchedule(Number(id));
  if (!schedule) return NextResponse.json({ ok: false, error: "Schedule not found" }, { status: 404 });

  return NextResponse.json({ ok: true, data: schedule });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const automation = await requireAutomationPermission("auto_schedule_manage");
  if (!isAutomationSession(automation)) return automation;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid schedule payload" }, { status: 400 });
  }

  try {
    await updateSchedule(Number(id), parsed.data, automation.userId);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Update failed" }, { status: 400 });
  }

  await logAdminAction({ admin: automation, section: "automation", action: "schedule_update", details: `Schedule #${id}`, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const automation = await requireAutomationPermission("auto_schedule_manage");
  if (!isAutomationSession(automation)) return automation;

  const { id } = await params;
  const existing = await getSchedule(Number(id));
  if (!existing) return NextResponse.json({ ok: false, error: "Schedule not found" }, { status: 404 });

  await deleteSchedule(Number(id));
  await logAdminAction({ admin: automation, section: "automation", action: "schedule_delete", details: existing.name, req });

  return NextResponse.json({ ok: true });
}
