import { NextResponse } from "next/server";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { REPORT_DEFINITIONS } from "@/lib/itAssetLogsheet/reports";

export async function GET() {
  const ita = await requireItAssetPermission("ita_reports_view");
  if (!isItAssetSession(ita)) return ita;

  return NextResponse.json({ ok: true, data: REPORT_DEFINITIONS });
}
