import { NextRequest, NextResponse } from "next/server";
import { requireAppActivityPermission, isAppActivitySession } from "@/lib/requireAppActivityPermission";
import { getAppActivitySettings, updateAppActivitySettings } from "@/lib/appActivity/repository";
import { updateAppActivitySettingsSchema } from "@/lib/appActivity/schema";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET() {
  const aa = await requireAppActivityPermission("aa_view");
  if (!isAppActivitySession(aa)) return aa;
  const settings = await getAppActivitySettings();
  return NextResponse.json({ ok: true, data: settings });
}

export async function PATCH(req: NextRequest) {
  const aa = await requireAppActivityPermission("aa_settings_manage");
  if (!isAppActivitySession(aa)) return aa;

  const body = await req.json().catch(() => null);
  const parsed = updateAppActivitySettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 400 });
  }

  await updateAppActivitySettings(parsed.data, aa.userId);
  await logAdminAction({ admin: aa, section: "app-activity", action: "settings_update", details: JSON.stringify(parsed.data), req });

  return NextResponse.json({ ok: true });
}
