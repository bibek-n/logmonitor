import { NextRequest, NextResponse } from "next/server";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";
import { removeBaseline } from "@/lib/intrusionDetection/fileIntegrity";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });

  await removeBaseline(id);
  await logAdminAction({ admin: session, section: "intrusion-detection", action: "file_integrity_baseline_remove", details: String(id), req });
  return NextResponse.json({ ok: true });
}
