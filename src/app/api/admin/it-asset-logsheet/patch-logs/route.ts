import { NextRequest, NextResponse } from "next/server";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { listPatchLogs } from "@/lib/itAssetLogsheet/repository";

// Cross-asset list, backing the "Patches and Updates" nav page.
export async function GET(req: NextRequest) {
  const ita = await requireItAssetPermission("ita_view");
  if (!isItAssetSession(ita)) return ita;

  const params = req.nextUrl.searchParams;
  const result = await listPatchLogs({
    severity: params.get("severity") ?? undefined,
    installationStatus: params.get("installationStatus") ?? undefined,
    page: params.get("page") ? Number(params.get("page")) : undefined,
    pageSize: params.get("pageSize") ? Number(params.get("pageSize")) : undefined,
  });

  return NextResponse.json({ ok: true, data: result.logs, total: result.total });
}
