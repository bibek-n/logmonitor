import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { updateCredentialSchema } from "@/lib/remoteAccess/schema";
import { deleteCredential, updateCredential } from "@/lib/remoteAccess/repository";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_credentials_manage");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateCredentialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid credential payload" }, { status: 400 });
  }

  try {
    await updateCredential(Number(id), parsed.data, ra.userId);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Update failed" }, { status: 400 });
  }
  await logAdminAction({ admin: ra, section: "remote-access", action: "credential_update", details: `Credential #${id}`, req });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_credentials_manage");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  await deleteCredential(Number(id));
  await logAdminAction({ admin: ra, section: "remote-access", action: "credential_delete", details: `Credential #${id}`, req });
  return NextResponse.json({ ok: true });
}
