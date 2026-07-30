import { NextResponse } from "next/server";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { getDashboardStats } from "@/lib/itAssetLogsheet/repository";

export async function GET() {
  const ita = await requireItAssetPermission("ita_view");
  if (!isItAssetSession(ita)) return ita;

  const stats = await getDashboardStats();
  return NextResponse.json({ ok: true, data: stats });
}
