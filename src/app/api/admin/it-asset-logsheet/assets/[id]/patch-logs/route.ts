import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { createPatchUpdateLogSchema } from "@/lib/itAssetLogsheet/schema";
import { createPatchLog, getAssetById, listPatchLogsForAsset } from "@/lib/itAssetLogsheet/repository";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ita = await requireItAssetPermission("ita_view");
  if (!isItAssetSession(ita)) return ita;

  const logs = await listPatchLogsForAsset(Number((await params).id));
  return NextResponse.json({ ok: true, data: logs });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ita = await requireItAssetPermission("ita_patch_manage");
  if (!isItAssetSession(ita)) return ita;

  const assetId = Number((await params).id);
  const asset = await getAssetById(assetId);
  if (!asset) return NextResponse.json({ ok: false, error: "Asset not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createPatchUpdateLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid record" }, { status: 400 });
  }

  const id = await createPatchLog(assetId, parsed.data, { userId: ita.userId, username: ita.username });
  await logAdminAction({
    admin: ita,
    section: "it-asset-logsheet",
    action: "patch_log_create",
    details: `${asset.assetTag}: ${parsed.data.patchName} (${parsed.data.severity})`,
    req,
  });

  return NextResponse.json({ ok: true, data: { id, requiresImmediateAlert: parsed.data.severity === "Critical" } });
}
