import { NextRequest, NextResponse } from "next/server";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { markNotificationRead } from "@/lib/itAssetLogsheet/alerts";
import { logAdminAction } from "@/lib/adminAudit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ita = await requireItAssetPermission("ita_alerts_manage");
  if (!isItAssetSession(ita)) return ita;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ ok: false, error: "Invalid notification id." }, { status: 400 });
  }

  await markNotificationRead(id, ita.userId);
  await logAdminAction({ admin: ita, section: "it-asset-logsheet", action: "notification_mark_read", details: String(id), req });

  return NextResponse.json({ ok: true });
}
