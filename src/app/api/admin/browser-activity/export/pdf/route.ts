import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { logAdminAction } from "@/lib/adminAudit";
import { isBrowserActivitySession, requireBrowserActivityPermission } from "@/lib/requireBrowserActivityPermission";
import { listEvents, type EventFilter } from "@/lib/browserActivity/repository";

// Pure JS pdfkit, no native bindings — consistent with this app's established avoidance of
// native dependencies on its Windows/iisnode host (see websiteSecurityAudit/generatePdf.ts).
async function buildPdf(events: Awaited<ReturnType<typeof listEvents>>["events"], canViewTitles: boolean): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.fontSize(16).text("Browser Activity Audit — Export", { align: "left" });
  doc.fontSize(9).fillColor("#666").text(`Generated ${new Date().toISOString()} — ${events.length} event(s)`);
  doc.moveDown();

  doc.fontSize(8).fillColor("#000");
  const colWidths = [70, 40, 70, 45, 90, 90, 45, 60];
  const headers = ["Visited At", "Emp ID", "Device", "Browser", "Domain", "Title", "Category", "Risk"];
  let y = doc.y;
  headers.forEach((h, i) => doc.text(h, 40 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, { width: colWidths[i], continued: false }));
  doc.moveDown(0.5);

  for (const e of events) {
    y = doc.y;
    if (y > 760) {
      doc.addPage();
      y = doc.y;
    }
    const title = canViewTitles ? (e.pageTitle ?? "") : e.pageTitle ? "•••" : "";
    const values = [
      e.visitedAt.toISOString().slice(0, 16).replace("T", " "),
      String(e.staffId ?? ""),
      e.deviceId.slice(0, 8),
      e.browser,
      e.domain,
      title,
      e.categoryName ?? "Uncategorized",
      e.riskLevel,
    ];
    values.forEach((v, i) =>
      doc.text(v, 40 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, { width: colWidths[i], ellipsis: true })
    );
    doc.moveDown(0.3);
  }

  doc.end();
  return done;
}

export async function GET(req: NextRequest) {
  const ba = await requireBrowserActivityPermission("ba_export");
  if (!isBrowserActivitySession(ba)) return ba;

  const url = new URL(req.url);
  const filter: EventFilter = {
    staffId: url.searchParams.get("staffId") ? Number(url.searchParams.get("staffId")) : undefined,
    domain: url.searchParams.get("domain") ?? undefined,
    browser: url.searchParams.get("browser") ?? undefined,
    deviceId: url.searchParams.get("deviceId") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    categoryId: url.searchParams.get("categoryId") ? Number(url.searchParams.get("categoryId")) : undefined,
    riskLevel: url.searchParams.get("riskLevel") ?? undefined,
    pageSize: 1000, // PDF export cap — bounded and intentional, not silent (kept lower than CSV's since every row is hand-laid-out)
  };

  const titlesCheck = await requireBrowserActivityPermission("ba_view_page_titles");
  const canViewTitles = isBrowserActivitySession(titlesCheck);

  const result = await listEvents(filter);
  const buffer = await buildPdf(result.events, canViewTitles);

  await logAdminAction({
    admin: ba,
    section: "browser-activity",
    action: "export_pdf",
    details: JSON.stringify({ ...filter, rowCount: result.events.length }),
    req,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="browser-activity-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
