import { NextRequest, NextResponse } from "next/server";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";
import { rollbackAction } from "@/lib/intrusionDetection/responseActions";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });

  const result = await rollbackAction(id);
  await logAdminAction({ admin: session, section: "intrusion-detection", action: "response_action_rollback", details: `${id}: ${result.ok ? result.result : result.error}`, req });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, data: { result: result.result } });
}
