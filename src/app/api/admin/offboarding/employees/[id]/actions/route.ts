import { NextResponse } from "next/server";
import { isOffboardingSession, requireOffboardingPermission } from "@/lib/requireOffboardingPermission";
import { listActionsForEmployee } from "@/lib/offboarding/repository";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = await requireOffboardingPermission("off_audit_view");
  if (!isOffboardingSession(off)) return off;

  const { id } = await params;
  const actions = await listActionsForEmployee(Number(id));
  // The encrypted Glesys password is never sent here - only the dedicated reveal route (its own
  // permission + a fresh password re-check) can produce the plaintext.
  const data = actions.map(({ glesysNewPasswordEncrypted: _glesysNewPasswordEncrypted, ...rest }) => rest);
  return NextResponse.json({ ok: true, data });
}
