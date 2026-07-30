import { NextRequest, NextResponse } from "next/server";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { listPasswordLogs } from "@/lib/itAssetLogsheet/repository";

// Cross-asset list, backing the "Password Changes" nav page — distinct from
// assets/[id]/password-logs, which is scoped to one asset's history tab.
export async function GET(req: NextRequest) {
  const ita = await requireItAssetPermission("ita_view");
  if (!isItAssetSession(ita)) return ita;

  const params = req.nextUrl.searchParams;
  const result = await listPasswordLogs({
    status: params.get("status") ?? undefined,
    accountType: params.get("accountType") ?? undefined,
    page: params.get("page") ? Number(params.get("page")) : undefined,
    pageSize: params.get("pageSize") ? Number(params.get("pageSize")) : undefined,
  });

  return NextResponse.json({ ok: true, data: result.logs, total: result.total });
}
