import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isBrowserActivitySession, requireBrowserActivityPermission } from "@/lib/requireBrowserActivityPermission";
import { listEvents } from "@/lib/browserActivity/repository";

export async function GET(req: NextRequest) {
  const ba = await requireBrowserActivityPermission("ba_view_security_alerts");
  if (!isBrowserActivitySession(ba)) return ba;

  const url = new URL(req.url);
  const page = url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined;
  const pageSize = url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined;

  const result = await listEvents({ securityOnly: true, page, pageSize });
  await logAdminAction({ admin: ba, section: "browser-activity", action: "view_security_alerts", req });

  return NextResponse.json({ ok: true, data: result });
}
