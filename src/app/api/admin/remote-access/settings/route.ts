import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { updateSettingsSchema } from "@/lib/remoteAccess/schema";
import { getSettings, updateSettings } from "@/lib/remoteAccess/repository";

export async function GET() {
  const ra = await requireRemoteAccessPermission("ra_settings_manage");
  if (!isRemoteAccessSession(ra)) return ra;

  return NextResponse.json({ ok: true, data: await getSettings() });
}

export async function PUT(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_settings_manage");
  if (!isRemoteAccessSession(ra)) return ra;

  const body = await req.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings payload" }, { status: 400 });
  }

  await updateSettings(parsed.data, ra.userId);
  await logAdminAction({ admin: ra, section: "remote-access", action: "settings_update", req });
  return NextResponse.json({ ok: true });
}
