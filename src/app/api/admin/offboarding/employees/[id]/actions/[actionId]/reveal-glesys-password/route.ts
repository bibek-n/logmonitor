import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAction } from "@/lib/adminAudit";
import { isOffboardingSession, requireOffboardingPermission } from "@/lib/requireOffboardingPermission";
import { verifyPasswordForReveal } from "@/lib/remoteAccess/crypto";
import { decryptOffboardingSecret } from "@/lib/offboarding/crypto";
import { getActionById } from "@/lib/offboarding/repository";

// Reveals the random password this offboarding reset a Glesys mailbox to - the actual handoff
// credential a manager needs to read the departed employee's mail. Same "re-check the current
// user's own password fresh on every reveal, no timed unlock window" pattern as the Remote
// Access Credentials Vault's reveal routes (reuses that same verification function directly).
const revealSchema = z.object({ password: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; actionId: string }> }) {
  const off = await requireOffboardingPermission("off_execute");
  if (!isOffboardingSession(off)) return off;

  const body = await req.json().catch(() => null);
  const parsed = revealSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Password is required" }, { status: 400 });

  const verified = await verifyPasswordForReveal(off.username, parsed.data.password);
  if (!verified) return NextResponse.json({ ok: false, error: "Incorrect password" }, { status: 401 });

  const { actionId } = await params;
  const action = await getActionById(Number(actionId));
  if (!action.glesysNewPasswordEncrypted) {
    return NextResponse.json({ ok: false, error: "No Glesys password reset is on record for this action." }, { status: 404 });
  }

  const password = decryptOffboardingSecret(action.glesysNewPasswordEncrypted);
  await logAdminAction({ admin: off, section: "offboarding", action: "reveal_glesys_password", details: `Action #${actionId}` });

  return NextResponse.json({ ok: true, data: { password } });
}
