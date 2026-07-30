import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { updateScriptSchema } from "@/lib/remoteAccess/schema";
import { deleteScript, updateScript } from "@/lib/remoteAccess/repository";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_scripts_execute");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateScriptSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid script" }, { status: 400 });

  await updateScript(Number(id), parsed.data, ra.userId);
  await logAdminAction({ admin: ra, section: "remote-access", action: "script_update", details: `#${id}`, req });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_scripts_execute");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  await deleteScript(Number(id));
  await logAdminAction({ admin: ra, section: "remote-access", action: "script_delete", details: `#${id}`, req });
  return NextResponse.json({ ok: true });
}
