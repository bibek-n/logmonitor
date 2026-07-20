import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { loadScanDetail } from "@/lib/websiteSecurityAudit/scanDetail";
import { getOrGenerateAuditPdf } from "@/lib/websiteSecurityAudit/generatePdf";

export async function GET(req: NextRequest, { params }: { params: Promise<{ scanId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const inline = req.nextUrl.searchParams.get("view") === "1";

  const { scanId: scanIdParam } = await params;
  const scanId = Number(scanIdParam);
  if (!Number.isInteger(scanId) || scanId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid scan id" }, { status: 400 });
  }

  const detail = await loadScanDetail(scanId);
  if (!detail || detail.status !== "Completed") {
    return NextResponse.json({ ok: false, error: "Scan report not available" }, { status: 404 });
  }

  const { buffer: pdfBytes, filename } = await getOrGenerateAuditPdf(scanId, detail);

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
    },
  });
}
