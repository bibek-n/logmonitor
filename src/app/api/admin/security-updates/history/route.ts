import { NextRequest, NextResponse } from "next/server";
import { requireSecurityUpdatesPermission, isSecurityUpdatesSession } from "@/lib/requireSecurityUpdatesPermission";
import { listHistory } from "@/lib/securityUpdates/queries";
import { parseHistoryFilters } from "@/lib/securityUpdates/filters";

export async function GET(req: NextRequest) {
  const su = await requireSecurityUpdatesPermission("su_history");
  if (!isSecurityUpdatesSession(su)) return su;

  const p = req.nextUrl.searchParams;
  const page = Math.max(1, Number(p.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(p.get("pageSize")) || 25));

  try {
    const result = await listHistory({ ...parseHistoryFilters(p), page, pageSize });
    return NextResponse.json({ ok: true, data: result.rows, total: result.total, page, pageSize });
  } catch (err) {
    console.error("security-updates history failed", err);
    return NextResponse.json({ ok: false, error: "Failed to load history" });
  }
}
