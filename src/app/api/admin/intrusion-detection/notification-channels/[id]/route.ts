import { NextRequest, NextResponse } from "next/server";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";
import { updateChannel, deleteChannel } from "@/lib/intrusionDetection/notificationChannels";
import { SEVERITY_ORDER, type Severity } from "@/lib/intrusionDetection/shared";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const patch: { name?: string; enabled?: boolean; minSeverity?: Severity } = {};
  if (typeof body?.name === "string") patch.name = body.name.trim().slice(0, 200);
  if (typeof body?.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body?.minSeverity === "string") {
    if (!SEVERITY_ORDER.includes(body.minSeverity as Severity)) return NextResponse.json({ ok: false, error: "Invalid minSeverity." }, { status: 400 });
    patch.minSeverity = body.minSeverity as Severity;
  }

  await updateChannel(id, patch);
  await logAdminAction({ admin: session, section: "intrusion-detection", action: "notification_channel_update", details: JSON.stringify(patch), req });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });

  await deleteChannel(id);
  await logAdminAction({ admin: session, section: "intrusion-detection", action: "notification_channel_delete", details: String(id), req });
  return NextResponse.json({ ok: true });
}
