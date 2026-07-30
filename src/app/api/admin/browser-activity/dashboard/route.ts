import { NextRequest, NextResponse } from "next/server";
import { isBrowserActivitySession, requireBrowserActivityPermission } from "@/lib/requireBrowserActivityPermission";
import { getDashboardStats } from "@/lib/browserActivity/repository";

export async function GET(req: NextRequest) {
  const ba = await requireBrowserActivityPermission("ba_view");
  if (!isBrowserActivitySession(ba)) return ba;

  const url = new URL(req.url);
  const dateFrom = url.searchParams.get("dateFrom") ? new Date(url.searchParams.get("dateFrom")!) : new Date(Date.now() - 7 * 86400000);
  const dateTo = url.searchParams.get("dateTo") ? new Date(url.searchParams.get("dateTo")!) : new Date();

  const stats = await getDashboardStats(dateFrom, dateTo);
  return NextResponse.json({ ok: true, data: stats });
}
