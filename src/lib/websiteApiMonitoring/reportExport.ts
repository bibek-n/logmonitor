import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import type { WebsiteMonitorReportRow } from "./repository";

const COLUMNS = [
  { header: "Name", key: "name", width: 26 },
  { header: "URL", key: "url", width: 38 },
  { header: "Status", key: "status", width: 10 },
  { header: "Uptime (7d)", key: "uptime", width: 12 },
  { header: "Last Response", key: "lastResponse", width: 14 },
  { header: "Open Incidents", key: "openIncidents", width: 14 },
] as const;

function cellValue(r: WebsiteMonitorReportRow, key: (typeof COLUMNS)[number]["key"]): string {
  switch (key) {
    case "name":
      return r.name;
    case "url":
      return r.url;
    case "status":
      return r.status;
    case "uptime":
      return r.uptimePercent7d === null ? "-" : `${r.uptimePercent7d.toFixed(2)}%`;
    case "lastResponse":
      return r.lastResponseMs === null ? "-" : `${r.lastResponseMs} ms`;
    case "openIncidents":
      return String(r.openIncidents);
  }
}

// A comma anywhere in a field (a monitor name, most plausibly) would otherwise silently corrupt
// the CSV's column boundaries - standard RFC 4180 quoting: wrap in quotes and double up any
// quote characters, whenever the field contains a comma, quote, or newline.
function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildReportCsv(rows: WebsiteMonitorReportRow[]): string {
  const header = COLUMNS.map((c) => csvEscape(c.header)).join(",");
  const lines = rows.map((r) => COLUMNS.map((c) => csvEscape(cellValue(r, c.key))).join(","));
  return [header, ...lines].join("\r\n");
}

export async function buildReportExcel(rows: WebsiteMonitorReportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Monitors");
  sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  sheet.getRow(1).font = { bold: true };
  for (const r of rows) {
    sheet.addRow(Object.fromEntries(COLUMNS.map((c) => [c.key, cellValue(r, c.key)])));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Pure JS, no native bindings or chart library - matching the same pdfkit convention this app
// already established in websiteSecurityAudit/generatePdf.ts (avoids a native-canvas dependency
// on the Windows/iisnode host). A plain tabular report - the audit PDF's charts/TOC machinery
// isn't warranted here, this is a status snapshot, not a multi-section findings document.
export async function buildReportPdf(rows: WebsiteMonitorReportRow[], generatedAt: Date, title: string): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const upCount = rows.filter((r) => r.status === "Up").length;
  const downCount = rows.filter((r) => r.status === "Down").length;

  doc.fontSize(18).text(title, { align: "left" });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor("#555").text(`Generated ${generatedAt.toUTCString()}`);
  doc.text(`${rows.length} monitor(s) - ${upCount} up, ${downCount} down, ${rows.length - upCount - downCount} other`);
  doc.moveDown(1);
  doc.fillColor("#000");

  const startX = doc.page.margins.left;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidths = [0.22, 0.32, 0.1, 0.12, 0.12, 0.12].map((f) => f * usableWidth);
  const rowHeight = 18;

  function drawRow(values: string[], y: number, bold: boolean) {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
    let x = startX;
    for (let i = 0; i < values.length; i++) {
      doc.text(values[i], x, y, { width: colWidths[i] - 4, ellipsis: true });
      x += colWidths[i];
    }
  }

  let y = doc.y;
  drawRow(COLUMNS.map((c) => c.header), y, true);
  y += rowHeight;
  doc.moveTo(startX, y - 4).lineTo(startX + usableWidth, y - 4).strokeColor("#ccc").stroke();

  for (const r of rows) {
    if (y > doc.page.height - doc.page.margins.bottom - rowHeight) {
      doc.addPage();
      y = doc.page.margins.top;
      drawRow(COLUMNS.map((c) => c.header), y, true);
      y += rowHeight;
    }
    drawRow(COLUMNS.map((c) => cellValue(r, c.key)), y, false);
    y += rowHeight;
  }

  doc.end();
  return done;
}
