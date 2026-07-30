import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { createPasswordChangeLogSchema } from "@/lib/itAssetLogsheet/schema";
import { createPasswordLog, getAssetById, getItAssetSettings, listPasswordLogsForAsset } from "@/lib/itAssetLogsheet/repository";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ita = await requireItAssetPermission("ita_view");
  if (!isItAssetSession(ita)) return ita;

  const logs = await listPasswordLogsForAsset(Number((await params).id));
  return NextResponse.json({ ok: true, data: logs });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ita = await requireItAssetPermission("ita_password_manage");
  if (!isItAssetSession(ita)) return ita;

  const assetId = Number((await params).id);
  const asset = await getAssetById(assetId);
  if (!asset) return NextResponse.json({ ok: false, error: "Asset not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createPasswordChangeLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid record" }, { status: 400 });
  }

  const settings = await getItAssetSettings();
  const id = await createPasswordLog(assetId, parsed.data, { userId: ita.userId, username: ita.username }, settings.passwordDueSoonDays);
  await logAdminAction({ admin: ita, section: "it-asset-logsheet", action: "password_log_create", details: `${asset.assetTag}: ${parsed.data.accountOrServiceName}`, req });

  return NextResponse.json({ ok: true, data: { id } });
}
