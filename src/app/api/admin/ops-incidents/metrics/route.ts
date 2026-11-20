import { NextRequest, NextResponse } from "next/server";
import { requireOpsIncidentsPermission, isOpsIncidentsSession } from "@/lib/requireOpsIncidentsPermission";
import { getMttaMttrReport } from "@/lib/opsIncidents/metrics";

export async function GET(req: NextRequest) {
  const oi = await requireOpsIncidentsPermission("oi_view");
  if (!isOpsIncidentsSession(oi)) return oi;

  const monthsParam = Number(req.nextUrl.searchParams.get("months"));
  const months = Number.isInteger(monthsParam) && monthsParam > 0 ? monthsParam : 6;

  const report = await getMttaMttrReport(months);
  return NextResponse.json({ ok: true, data: report });
}
