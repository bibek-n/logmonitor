import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { writeAuditEvent } from "@/lib/remoteAccess/auditLog";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { markCredentialRotated } from "@/lib/remoteAccess/repository";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_credentials_manage");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  await markCredentialRotated(Number(id), ra.userId);
  await writeAuditEvent({ eventType: "CredentialUsed", userId: ra.userId, username: ra.username, action: `Credential #${id} marked rotated`, result: "Success" });
  await logAdminAction({ admin: ra, section: "remote-access", action: "credential_mark_rotated", details: `#${id}`, req });
  return NextResponse.json({ ok: true });
}
