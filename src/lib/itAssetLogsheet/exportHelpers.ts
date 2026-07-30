import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";

// Shared CSV/Excel/PDF rendering for both the asset-list export and all 15 report types
// (reports.ts) - one generic {header,key,width}[] + Record<string,string>[] shape covers
// every tabular export this module needs, matching the same pattern already established in
// websiteApiMonitoring/reportExport.ts rather than hand-rolling a renderer per report.
export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildCsv(columns: ExportColumn[], rows: Record<string, string>[]): string {
  const header = columns.map((c) => csvEscape(c.header)).join(",");
  const lines = rows.map((row) => columns.map((c) => csvEscape(row[c.key] ?? "")).join(","));
  return [header, ...lines].join("\r\n");
}

export async function buildExcel(columns: ExportColumn[], rows: Record<string, string>[], sheetName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31)); // Excel sheet-name length cap
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 20 }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Pure JS pdfkit, no native bindings - matching the same convention already established in
// websiteSecurityAudit/generatePdf.ts and websiteApiMonitoring/reportExport.ts for this app's
// Windows/iisnode host.
export async function buildPdf(columns: ExportColumn[], rows: Record<string, string>[], title: string, generatedAt: Date, subtitle?: string): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 40, size: "A4", layout: columns.length > 6 ? "landscape" : "portrait" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.fontSize(16).text(title, { align: "left" });
  doc.fontSize(9).fillColor("#666").text(`Generated ${generatedAt.toUTCString()} — ${rows.length} row(s)`);
  if (subtitle) doc.text(subtitle);
  doc.moveDown(0.5);
  doc.fillColor("#000");

  const startX = doc.page.margins.left;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const totalWeight = columns.reduce((sum, c) => sum + (c.width ?? 20), 0);
  const colWidths = columns.map((c) => ((c.width ?? 20) / totalWeight) * usableWidth);
  const rowHeight = 16;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;

  function drawRow(values: string[], y: number, bold: boolean) {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
    let x = startX;
    for (let i = 0; i < values.length; i++) {
      doc.text(values[i], x, y, { width: colWidths[i] - 4, ellipsis: true });
      x += colWidths[i];
    }
  }

  let y = doc.y;
  drawRow(columns.map((c) => c.header), y, true);
  y += rowHeight;
  doc.moveTo(startX, y - 4).lineTo(startX + usableWidth, y - 4).strokeColor("#ccc").stroke();

  for (const row of rows) {
    if (y + rowHeight > bottomLimit) {
      doc.addPage({ margin: 40, size: "A4", layout: columns.length > 6 ? "landscape" : "portrait" });
      y = doc.y;
      drawRow(columns.map((c) => c.header), y, true);
      y += rowHeight;
    }
    drawRow(columns.map((c) => row[c.key] ?? ""), y, false);
    y += rowHeight;
  }

  doc.end();
  return done;
}

export function exportContentType(format: string): string {
  switch (format) {
    case "excel":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "pdf":
      return "application/pdf";
    default:
      return "text/csv; charset=utf-8";
  }
}

export function exportFileExtension(format: string): string {
  switch (format) {
    case "excel":
      return "xlsx";
    case "pdf":
      return "pdf";
    default:
      return "csv";
  }
}
