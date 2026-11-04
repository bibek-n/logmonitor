import { NextRequest, NextResponse } from "next/server";
import { requireWordpressScanPermission, isWordpressScanSession } from "@/lib/requireWordpressScanPermission";
import { listFindings, isFindingStatus } from "@/lib/wordpressScan/findings";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

export async function GET(req: NextRequest) {
  const admin = await requireWordpressScanPermission("wps_view");
  if (!isWordpressScanSession(admin)) return admin;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(sp.get("pageSize")) || PAGE_SIZE_DEFAULT));
  const websiteIdParam = sp.get("websiteId");
  const statusParam = sp.get("status");
  const severityParam = sp.get("severity");

  const { rows, total } = await listFindings({
    websiteId: websiteIdParam ? Number(websiteIdParam) : undefined,
    status: statusParam && isFindingStatus(statusParam) ? statusParam : undefined,
    severity: severityParam || undefined,
    page,
    pageSize,
  });

  return NextResponse.json({
    ok: true,
    data: rows,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}
