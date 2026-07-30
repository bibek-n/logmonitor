import { NextRequest, NextResponse } from "next/server";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { listNotifications, markAllNotificationsRead } from "@/lib/itAssetLogsheet/alerts";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET(req: NextRequest) {
  const ita = await requireItAssetPermission("ita_alerts_manage");
  if (!isItAssetSession(ita)) return ita;

  const params = req.nextUrl.searchParams;
  const isReadParam = params.get("isRead");
  const data = await listNotifications({
    isRead: isReadParam === null ? undefined : isReadParam === "true",
    severity: params.get("severity") ?? undefined,
    page: params.get("page") ? Number(params.get("page")) : undefined,
    pageSize: params.get("pageSize") ? Number(params.get("pageSize")) : undefined,
  });

  return NextResponse.json({ ok: true, data });
}

export async function PATCH(req: NextRequest) {
  const ita = await requireItAssetPermission("ita_alerts_manage");
  if (!isItAssetSession(ita)) return ita;

  const body = await req.json().catch(() => null);
  if (body?.action !== "mark_all_read") {
    return NextResponse.json({ ok: false, error: "Unsupported action." }, { status: 400 });
  }

  const updated = await markAllNotificationsRead(ita.userId);
  await logAdminAction({ admin: ita, section: "it-asset-logsheet", action: "notifications_mark_all_read", details: JSON.stringify({ updated }), req });

  return NextResponse.json({ ok: true, data: { updated } });
}
