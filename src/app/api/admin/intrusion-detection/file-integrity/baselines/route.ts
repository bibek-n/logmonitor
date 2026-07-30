import { NextRequest, NextResponse } from "next/server";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";
import { listBaselines, addBaseline } from "@/lib/intrusionDetection/fileIntegrity";

export async function GET() {
  const session = await requireSecurityRole("viewer");
  if (!isSecuritySession(session)) return session;

  const baselines = await listBaselines();
  return NextResponse.json({ ok: true, data: baselines });
}

export async function POST(req: NextRequest) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const body = await req.json().catch(() => null);
  const filePath = typeof body?.filePath === "string" ? body.filePath.trim() : "";
  if (!filePath) {
    return NextResponse.json({ ok: false, error: "filePath is required." }, { status: 400 });
  }

  const result = await addBaseline(filePath, session.userId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  await logAdminAction({ admin: session, section: "intrusion-detection", action: "file_integrity_baseline_add", details: filePath, req });
  return NextResponse.json({ ok: true, data: { id: result.id } });
}
