import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isBrowserActivitySession, requireBrowserActivityPermission } from "@/lib/requireBrowserActivityPermission";
import { updateSettingsSchema } from "@/lib/browserActivity/schema";
import { getBrowserActivitySettings, updateBrowserActivitySettings } from "@/lib/browserActivity/repository";

export async function GET() {
  const ba = await requireBrowserActivityPermission("ba_view");
  if (!isBrowserActivitySession(ba)) return ba;

  const settings = await getBrowserActivitySettings();
  return NextResponse.json({ ok: true, data: settings });
}

export async function PATCH(req: NextRequest) {
  const ba = await requireBrowserActivityPermission("ba_settings_manage");
  if (!isBrowserActivitySession(ba)) return ba;

  const body = await req.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 400 });
  }

  await updateBrowserActivitySettings(parsed.data, ba.userId);
  await logAdminAction({ admin: ba, section: "browser-activity", action: "settings_update", details: JSON.stringify(parsed.data), req });

  return NextResponse.json({ ok: true });
}
