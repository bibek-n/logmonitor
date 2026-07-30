import { NextRequest, NextResponse } from "next/server";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";
import { testChannel } from "@/lib/intrusionDetection/notificationChannels";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });

  const result = await testChannel(id);
  await logAdminAction({ admin: session, section: "intrusion-detection", action: "notification_channel_test", details: `${id}: ${result.success ? "sent" : result.error}`, req });
  return NextResponse.json({ ok: result.success, error: result.error ?? undefined });
}
