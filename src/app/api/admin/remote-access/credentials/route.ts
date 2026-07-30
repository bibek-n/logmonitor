import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { createCredentialSchema } from "@/lib/remoteAccess/schema";
import { createCredential, listCredentials } from "@/lib/remoteAccess/repository";

// Secrets are structurally never selected here (see repository.ts's CREDENTIAL_COLUMNS_NO_SECRET) -
// this route cannot leak a secret even if it tried to, because the object it has doesn't contain one.
export async function GET() {
  const ra = await requireRemoteAccessPermission("ra_credentials_use");
  if (!isRemoteAccessSession(ra)) return ra;

  return NextResponse.json({ ok: true, data: await listCredentials() });
}

export async function POST(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_credentials_manage");
  if (!isRemoteAccessSession(ra)) return ra;

  const body = await req.json().catch(() => null);
  const parsed = createCredentialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid credential payload" }, { status: 400 });
  }

  const id = await createCredential(parsed.data, ra.userId);
  await logAdminAction({ admin: ra, section: "remote-access", action: "credential_create", details: `${parsed.data.name} (${parsed.data.credentialType})`, req });

  return NextResponse.json({ ok: true, data: { id } });
}
