import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { createMaintenanceLogSchema } from "@/lib/itAssetLogsheet/schema";
import { createMaintenanceLog, getAssetById, listMaintenanceForAsset } from "@/lib/itAssetLogsheet/repository";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ita = await requireItAssetPermission("ita_view");
  if (!isItAssetSession(ita)) return ita;

  const logs = await listMaintenanceForAsset(Number((await params).id));
  return NextResponse.json({ ok: true, data: logs });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ita = await requireItAssetPermission("ita_maintenance_manage");
  if (!isItAssetSession(ita)) return ita;

  const assetId = Number((await params).id);
  const body = await req.json().catch(() => null);
  const parsed = createMaintenanceLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid record" }, { status: 400 });
  }

  const result = await createMaintenanceLog(assetId, parsed.data, { userId: ita.userId, username: ita.username });
  if (typeof result === "object" && "error" in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  const asset = await getAssetById(assetId);
  await logAdminAction({ admin: ita, section: "it-asset-logsheet", action: "maintenance_create", details: `${asset?.assetTag ?? assetId}: ${parsed.data.activityTitle}`, req });

  return NextResponse.json({ ok: true, data: { id: result } });
}
