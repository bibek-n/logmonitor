import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { bulkUpdateAssetsSchema } from "@/lib/itAssetLogsheet/schema";
import { bulkUpdateAssets } from "@/lib/itAssetLogsheet/repository";

export async function PATCH(req: NextRequest) {
  const ita = await requireItAssetPermission("ita_asset_edit");
  if (!isItAssetSession(ita)) return ita;

  const body = await req.json().catch(() => null);
  const parsed = bulkUpdateAssetsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const updated = await bulkUpdateAssets(parsed.data.ids, parsed.data.patch, { userId: ita.userId, username: ita.username });
  await logAdminAction({
    admin: ita,
    section: "it-asset-logsheet",
    action: "asset_bulk_update",
    details: JSON.stringify({ assetIds: parsed.data.ids, patch: parsed.data.patch }),
    req,
  });

  return NextResponse.json({ ok: true, data: { updated } });
}
