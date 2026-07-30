import { NextRequest, NextResponse } from "next/server";
import { writeAuditEvent } from "@/lib/remoteAccess/auditLog";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { revealSecretSchema } from "@/lib/remoteAccess/schema";
import { verifyPasswordForReveal } from "@/lib/remoteAccess/crypto";
import { getSshPrivateKey, markSshKeyAccessed } from "@/lib/remoteAccess/repository";

// Same re-authentication-per-request rule as credential reveal - no standing unlock state.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_ssh_keys_manage");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = revealSecretSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Password is required to reveal a private key" }, { status: 400 });

  const passwordValid = await verifyPasswordForReveal(ra.username, parsed.data.password);
  if (!passwordValid) {
    await writeAuditEvent({
      eventType: "CredentialRevealed",
      userId: ra.userId,
      username: ra.username,
      action: `SSH Key #${id}`,
      result: "Failure",
      failureReason: "Re-authentication failed - incorrect password",
    });
    return NextResponse.json({ ok: false, error: "Incorrect password" }, { status: 401 });
  }

  const revealed = await getSshPrivateKey(Number(id));
  if (!revealed) return NextResponse.json({ ok: false, error: "SSH key not found" }, { status: 404 });

  await markSshKeyAccessed(Number(id), ra.userId);
  await writeAuditEvent({ eventType: "CredentialRevealed", userId: ra.userId, username: ra.username, action: `SSH Key #${id} (${revealed.name})`, result: "Success" });

  return NextResponse.json({ ok: true, data: { privateKeyPem: revealed.privateKeyPem } });
}
