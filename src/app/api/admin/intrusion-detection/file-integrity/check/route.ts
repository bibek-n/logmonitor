import { NextRequest, NextResponse } from "next/server";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";
import { checkFileIntegrity } from "@/lib/intrusionDetection/fileIntegrity";

// Manual trigger for the same check the scheduled task (intrusion-detection/check-file-
// integrity.ts) runs automatically - lets an admin verify a newly-added baseline immediately
// rather than waiting for the next scheduled run.
export async function POST(req: NextRequest) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const summary = await checkFileIntegrity();
  await logAdminAction({ admin: session, section: "intrusion-detection", action: "file_integrity_manual_check", details: JSON.stringify(summary), req });
  return NextResponse.json({ ok: true, data: summary });
}
