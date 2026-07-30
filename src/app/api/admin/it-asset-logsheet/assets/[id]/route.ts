import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { updateAssetSchema } from "@/lib/itAssetLogsheet/schema";
import {
  findAssetDuplicates,
  getAssetById,
  listMaintenanceForAsset,
  listPasswordLogsForAsset,
  listPatchLogsForAsset,
  listSoftwareForAsset,
  softDeleteAsset,
  updateAsset,
} from "@/lib/itAssetLogsheet/repository";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ita = await requireItAssetPermission("ita_view");
  if (!isItAssetSession(ita)) return ita;

  const id = Number((await params).id);
  const asset = await getAssetById(id);
  if (!asset) return NextResponse.json({ ok: false, error: "Asset not found" }, { status: 404 });

  const [passwordLogs, patchLogs, software, maintenance] = await Promise.all([
    listPasswordLogsForAsset(id),
    listPatchLogsForAsset(id),
    listSoftwareForAsset(id),
    listMaintenanceForAsset(id),
  ]);

  return NextResponse.json({ ok: true, data: { asset, passwordLogs, patchLogs, software, maintenance } });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ita = await requireItAssetPermission("ita_asset_edit");
  if (!isItAssetSession(ita)) return ita;

  const id = Number((await params).id);
  const existing = await getAssetById(id);
  if (!existing) return NextResponse.json({ ok: false, error: "Asset not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateAssetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid asset" }, { status: 400 });
  }

  if (parsed.data.assetTag || parsed.data.serialNumber || parsed.data.hostname || parsed.data.ipAddress) {
    const duplicates = await findAssetDuplicates({
      assetTag: parsed.data.assetTag ?? undefined,
      serialNumber: parsed.data.serialNumber ?? undefined,
      hostname: parsed.data.hostname ?? undefined,
      ipAddress: parsed.data.ipAddress ?? undefined,
      excludeId: id,
    });
    if (duplicates.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Another asset already uses this Asset Tag, Serial Number, Hostname, or IP Address.", duplicates: duplicates.map((d) => ({ id: d.id, assetTag: d.assetTag })) },
        { status: 409 }
      );
    }
  }

  await updateAsset(id, parsed.data, { userId: ita.userId, username: ita.username });
  await logAdminAction({
    admin: ita,
    section: "it-asset-logsheet",
    action: "asset_update",
    details: JSON.stringify({ id, changedFields: Object.keys(parsed.data) }),
    req,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ita = await requireItAssetPermission("ita_asset_delete");
  if (!isItAssetSession(ita)) return ita;

  const id = Number((await params).id);
  const existing = await getAssetById(id);
  if (!existing) return NextResponse.json({ ok: false, error: "Asset not found" }, { status: 404 });

  await softDeleteAsset(id, ita.userId);
  await logAdminAction({ admin: ita, section: "it-asset-logsheet", action: "asset_delete", details: existing.assetTag, req });

  return NextResponse.json({ ok: true });
}
