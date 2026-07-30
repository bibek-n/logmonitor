import { NextResponse } from "next/server";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { listImportHistory } from "@/lib/itAssetLogsheet/importExport";

export async function GET() {
  const ita = await requireItAssetPermission("ita_import");
  if (!isItAssetSession(ita)) return ita;

  const history = await listImportHistory();
  return NextResponse.json({ ok: true, data: history });
}
