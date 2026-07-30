import { NextRequest, NextResponse } from "next/server";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { listWebsiteMonitorsForReport, listApiMonitorsForReport } from "@/lib/websiteApiMonitoring/repository";
import { buildReportCsv, buildReportExcel, buildReportPdf } from "@/lib/websiteApiMonitoring/reportExport";

// On-demand file download - distinct from the existing /websites/send-report route (which
// emails a plain-text summary to chosen recipients). This one streams a real CSV/PDF/Excel
// file straight back to the browser for whoever clicked "Export" on the Reports page.
export async function GET(req: NextRequest) {
  const mon = await requireMonitoringPermission("mon_reports_view");
  if (!isMonitoringSession(mon)) return mon;

  const format = (req.nextUrl.searchParams.get("format") ?? "csv").toLowerCase();
  if (!["csv", "pdf", "excel"].includes(format)) {
    return NextResponse.json({ ok: false, error: "format must be csv, pdf, or excel" }, { status: 400 });
  }

  const [websiteRows, apiRows] = await Promise.all([listWebsiteMonitorsForReport(), listApiMonitorsForReport()]);
  const rows = [...websiteRows, ...apiRows];
  const generatedAt = new Date();
  const filenameBase = `monitoring-report-${generatedAt.toISOString().slice(0, 10)}`;

  if (format === "csv") {
    const csv = buildReportCsv(rows);
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filenameBase}.csv"` },
    });
  }

  if (format === "excel") {
    const buffer = await buildReportExcel(rows);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  }

  const buffer = await buildReportPdf(rows, generatedAt, "Website & API Monitoring Report");
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filenameBase}.pdf"` },
  });
}
