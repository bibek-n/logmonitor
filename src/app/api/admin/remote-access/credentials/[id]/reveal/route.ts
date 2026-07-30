import { NextRequest, NextResponse } from "next/server";
import { writeAuditEvent } from "@/lib/remoteAccess/auditLog";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { revealSecretSchema } from "@/lib/remoteAccess/schema";
import { verifyPasswordForReveal } from "@/lib/remoteAccess/crypto";
import { getCredentialSecret, markCredentialAccessed } from "@/lib/remoteAccess/repository";

// Re-authentication (the CURRENT user's own password) accompanies every single reveal request -
// never a standing "vault unlocked" cookie/session flag. Every call is audited, success or
// failure, per the spec's "audit all sensitive actions" and "redact secrets from audit logs"
// requirements (the audit row records that a reveal happened, never the secret itself).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_credentials_reveal");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = revealSecretSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Password is required to reveal a secret" }, { status: 400 });

  const passwordValid = await verifyPasswordForReveal(ra.username, parsed.data.password);
  if (!passwordValid) {
    await writeAuditEvent({
      eventType: "CredentialRevealed",
      userId: ra.userId,
      username: ra.username,
      action: `Credential #${id}`,
      result: "Failure",
      failureReason: "Re-authentication failed - incorrect password",
    });
    return NextResponse.json({ ok: false, error: "Incorrect password" }, { status: 401 });
  }

  const revealed = await getCredentialSecret(Number(id));
  if (!revealed) return NextResponse.json({ ok: false, error: "Credential not found" }, { status: 404 });

  await markCredentialAccessed(Number(id), ra.userId);
  await writeAuditEvent({
    eventType: "CredentialRevealed",
    userId: ra.userId,
    username: ra.username,
    action: `Credential #${id} (${revealed.name})`,
    result: "Success",
  });

  return NextResponse.json({ ok: true, data: { secret: revealed.secret } });
}
