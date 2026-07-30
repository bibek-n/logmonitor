import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { createScriptSchema } from "@/lib/remoteAccess/schema";
import { createScript, listScripts } from "@/lib/remoteAccess/repository";

export async function GET() {
  const ra = await requireRemoteAccessPermission("ra_scripts_execute");
  if (!isRemoteAccessSession(ra)) return ra;
  return NextResponse.json({ ok: true, data: await listScripts() });
}

export async function POST(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_scripts_execute");
  if (!isRemoteAccessSession(ra)) return ra;

  const body = await req.json().catch(() => null);
  const parsed = createScriptSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid script" }, { status: 400 });

  const id = await createScript(parsed.data, ra.userId);
  await logAdminAction({ admin: ra, section: "remote-access", action: "script_create", details: parsed.data.name, req });
  return NextResponse.json({ ok: true, data: { id } });
}
