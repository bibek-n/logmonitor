import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isAutomationSession, requireAutomationPermission } from "@/lib/requireAutomationPermission";
import { updateScriptSchema } from "@/lib/automation/schema";
import { deleteScript, getScript, updateScript } from "@/lib/automation/repository";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const automation = await requireAutomationPermission("auto_view");
  if (!isAutomationSession(automation)) return automation;

  const { id } = await params;
  const script = await getScript(Number(id));
  if (!script) return NextResponse.json({ ok: false, error: "Script not found" }, { status: 404 });

  return NextResponse.json({ ok: true, data: script });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const automation = await requireAutomationPermission("auto_script_manage");
  if (!isAutomationSession(automation)) return automation;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateScriptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid script payload" }, { status: 400 });
  }

  try {
    await updateScript(Number(id), parsed.data, automation.userId);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Update failed" }, { status: 400 });
  }

  await logAdminAction({ admin: automation, section: "automation", action: "script_update", details: `Script #${id}`, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const automation = await requireAutomationPermission("auto_script_manage");
  if (!isAutomationSession(automation)) return automation;

  const { id } = await params;
  const existing = await getScript(Number(id));
  if (!existing) return NextResponse.json({ ok: false, error: "Script not found" }, { status: 404 });

  await deleteScript(Number(id));
  await logAdminAction({ admin: automation, section: "automation", action: "script_delete", details: existing.name, req });

  return NextResponse.json({ ok: true });
}
