import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isAutomationSession, requireAutomationPermission } from "@/lib/requireAutomationPermission";
import { createScriptSchema } from "@/lib/automation/schema";
import { createScript, listScripts } from "@/lib/automation/repository";

export async function GET() {
  const automation = await requireAutomationPermission("auto_view");
  if (!isAutomationSession(automation)) return automation;

  const scripts = await listScripts();
  return NextResponse.json({ ok: true, data: scripts });
}

export async function POST(req: NextRequest) {
  const automation = await requireAutomationPermission("auto_script_manage");
  if (!isAutomationSession(automation)) return automation;

  const body = await req.json().catch(() => null);
  const parsed = createScriptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid script payload" }, { status: 400 });
  }

  const id = await createScript(parsed.data, automation.userId);
  await logAdminAction({ admin: automation, section: "automation", action: "script_create", details: parsed.data.name, req });

  return NextResponse.json({ ok: true, data: { id } });
}
