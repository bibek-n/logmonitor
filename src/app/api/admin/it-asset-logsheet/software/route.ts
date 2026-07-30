import { NextRequest, NextResponse } from "next/server";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { listSoftware } from "@/lib/itAssetLogsheet/repository";

// Cross-asset list, backing the "Software Inventory" nav page.
export async function GET(req: NextRequest) {
  const ita = await requireItAssetPermission("ita_view");
  if (!isItAssetSession(ita)) return ita;

  const params = req.nextUrl.searchParams;
  const result = await listSoftware({
    softwareStatus: params.get("softwareStatus") ?? undefined,
    approvalStatus: params.get("approvalStatus") ?? undefined,
    page: params.get("page") ? Number(params.get("page")) : undefined,
    pageSize: params.get("pageSize") ? Number(params.get("pageSize")) : undefined,
  });

  return NextResponse.json({ ok: true, data: result.items, total: result.total });
}
