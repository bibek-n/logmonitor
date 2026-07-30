import { NextRequest, NextResponse } from "next/server";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";
import { acknowledgeEvent } from "@/lib/intrusionDetection/fileIntegrity";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSecurityRole("security_analyst");
  if (!isSecuritySession(session)) return session;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });

  await acknowledgeEvent(id);
  await logAdminAction({ admin: session, section: "intrusion-detection", action: "file_integrity_event_acknowledge", details: String(id), req });
  return NextResponse.json({ ok: true });
}
