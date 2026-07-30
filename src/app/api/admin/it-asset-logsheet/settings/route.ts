import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { updateItAssetSettingsSchema } from "@/lib/itAssetLogsheet/schema";
import { getItAssetSettings, updateItAssetSettings } from "@/lib/itAssetLogsheet/repository";

export async function GET() {
  const ita = await requireItAssetPermission("ita_view");
  if (!isItAssetSession(ita)) return ita;

  const settings = await getItAssetSettings();
  return NextResponse.json({ ok: true, data: settings });
}

export async function PUT(req: NextRequest) {
  const ita = await requireItAssetPermission("ita_settings_manage");
  if (!isItAssetSession(ita)) return ita;

  const body = await req.json().catch(() => null);
  const parsed = updateItAssetSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 400 });
  }

  await updateItAssetSettings(parsed.data, ita.userId);
  await logAdminAction({ admin: ita, section: "it-asset-logsheet", action: "settings_update", details: JSON.stringify(Object.keys(parsed.data)), req });

  return NextResponse.json({ ok: true });
}
