import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { updateSoftwareInventorySchema } from "@/lib/itAssetLogsheet/schema";
import { getSoftwareById, softDeleteSoftware, updateSoftware } from "@/lib/itAssetLogsheet/repository";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; logId: string }> }) {
  const ita = await requireItAssetPermission("ita_software_manage");
  if (!isItAssetSession(ita)) return ita;

  const { logId } = await params;
  const existing = await getSoftwareById(Number(logId));
  if (!existing) return NextResponse.json({ ok: false, error: "Record not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateSoftwareInventorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid record" }, { status: 400 });
  }

  await updateSoftware(Number(logId), parsed.data, { userId: ita.userId, username: ita.username });
  await logAdminAction({ admin: ita, section: "it-asset-logsheet", action: "software_update", details: logId, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; logId: string }> }) {
  const ita = await requireItAssetPermission("ita_asset_delete");
  if (!isItAssetSession(ita)) return ita;

  const { logId } = await params;
  const existing = await getSoftwareById(Number(logId));
  if (!existing) return NextResponse.json({ ok: false, error: "Record not found" }, { status: 404 });

  await softDeleteSoftware(Number(logId), ita.userId);
  await logAdminAction({ admin: ita, section: "it-asset-logsheet", action: "software_delete", details: logId, req });

  return NextResponse.json({ ok: true });
}
