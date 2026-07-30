import PDFDocument from "pdfkit";
import type { WebsitePerformanceScanRow, WebsitePerformanceResourceMetricsRow, WebsiteOptimizationCheckRow } from "./shared";

const CONTENT_WIDTH = 495; // A4 (595.28pt) minus 50pt margins each side

function scoreColor(score: number | null): string {
  if (score === null) return "#6b7280";
  if (score < 50) return "#b91c1c";
  if (score < 75) return "#a16207";
  if (score < 90) return "#ca8a04";
  return "#15803d";
}

function severityColor(severity: string): string {
  switch (severity) {
    case "Critical":
      return "#b91c1c";
    case "High":
      return "#c2410c";
    case "Medium":
      return "#a16207";
    case "Low":
      return "#15803d";
    default:
      return "#6b7280";
  }
}

function statusColor(status: string): string {
  if (status === "Fail") return "#b91c1c";
  if (status === "Warning") return "#a16207";
  if (status === "Pass") return "#15803d";
  return "#6b7280";
}

function fmtMs(v: number | null): string {
  return v === null ? "N/A" : `${Math.round(v).toLocaleString()} ms`;
}

function fmtBytes(v: number | null): string {
  if (v === null) return "N/A";
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(2)} MB`;
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "website";
}

export function performanceReportFilename(websiteName: string, device: string, scanDate: string): string {
  return `${slugify(websiteName)}-performance-${device.toLowerCase()}-${scanDate}.pdf`;
}

export interface PerformanceReportInput {
  websiteName: string;
  websiteUrl: string;
  device: string;
  scan: WebsitePerformanceScanRow | null;
  resources: WebsitePerformanceResourceMetricsRow | null;
  checks: WebsiteOptimizationCheckRow[];
  history: WebsitePerformanceScanRow[]; // most recent first, same device, completed scans only
}

// Pure JS pdfkit, no native bindings or chart library - same convention already established by
// generateAuditPdf in websiteSecurityAudit (this app avoids native deps on its Windows/iisnode
// host). Deliberately narrower in scope than the security audit report: one device's latest
// scan, not a 20-section document - performance data doesn't have the same breadth of findings.
export async function generatePerformanceReportPdf(input: PerformanceReportInput): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  function heading(title: string) {
    doc.moveDown(1);
    doc.fontSize(14).fillColor("#000").text(title);
    doc.moveDown(0.3);
  }

  function bodyText(text: string, color = "#333") {
    doc.fontSize(9.5).fillColor(color).text(text);
  }

  function drawHorizontalBar(label: string, value: number | null, suffix = "/100") {
    const barWidth = CONTENT_WIDTH - 160;
    const barHeight = 13;
    const startX = doc.page.margins.left + 160;
    const y = doc.y;
    const color = scoreColor(value);
    doc.fontSize(9).fillColor("#333").text(label, doc.page.margins.left, y + 2, { width: 155 });
    doc.rect(startX, y, barWidth, barHeight).fillOpacity(0.15).fill("#9ca3af").fillOpacity(1);
    if (value !== null) {
      const w = Math.max(2, (Math.max(0, Math.min(100, value)) / 100) * barWidth);
      doc.rect(startX, y, w, barHeight).fill(color);
    }
    doc.fontSize(9).fillColor("#000").text(value === null ? "N/A" : `${value}${suffix}`, startX + barWidth + 6, y + 2);
    doc.y = y + barHeight + 8;
    doc.x = doc.page.margins.left;
  }

  function metricRow(label: string, value: string) {
    const y = doc.y;
    doc.fontSize(9.5).fillColor("#555").text(label, doc.page.margins.left, y, { width: 220, continued: false });
    doc.fontSize(9.5).fillColor("#000").text(value, doc.page.margins.left + 220, y);
    doc.moveDown(0.2);
  }

  function drawTrendChart(history: WebsitePerformanceScanRow[]) {
    const points = [...history].reverse().filter((h) => h.OverallScore !== null);
    if (points.length < 2) {
      bodyText("Not enough scan history yet to show a trend (need at least 2 completed scans with a score).", "#555");
      return;
    }
    const chartWidth = CONTENT_WIDTH;
    const chartHeight = 110;
    const startX = doc.page.margins.left;
    const startY = doc.y;

    doc
      .moveTo(startX, startY)
      .lineTo(startX, startY + chartHeight)
      .lineTo(startX + chartWidth, startY + chartHeight)
      .strokeColor("#999999")
      .lineWidth(1)
      .stroke();

    const n = points.length;
    const stepX = n > 1 ? chartWidth / (n - 1) : 0;
    const coords = points.map((h, i) => ({
      x: startX + i * stepX,
      y: startY + chartHeight - (Math.max(0, Math.min(100, h.OverallScore ?? 0)) / 100) * chartHeight,
      date: (h.CreatedAt ?? "").slice(0, 10),
    }));

    doc.strokeColor("#2563eb").lineWidth(1.5);
    coords.forEach((p, i) => {
      if (i === 0) doc.moveTo(p.x, p.y);
      else doc.lineTo(p.x, p.y);
    });
    doc.stroke();
    for (const p of coords) doc.circle(p.x, p.y, 3).fill("#2563eb");

    doc.fontSize(7).fillColor("#555");
    const labelStep = Math.max(1, Math.floor(n / 6));
    coords.forEach((p, i) => {
      if (i % labelStep === 0 || i === coords.length - 1) {
        doc.text(p.date, p.x - 20, startY + chartHeight + 4, { width: 40, align: "center" });
      }
    });

    doc.y = startY + chartHeight + 20;
    doc.x = startX;
  }

  // =========================================================================
  // Cover
  // =========================================================================
  doc.fontSize(22).fillColor("#000").text("Website Speed & Performance Report", { align: "center" });
  doc.moveDown(1);
  doc.fontSize(14).fillColor("#333").text(input.websiteName, { align: "center" });
  doc.fontSize(10).fillColor("#555").text(input.websiteUrl, { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#555").text(`Device: ${input.device}`, { align: "center" });
  doc.fontSize(10).fillColor("#555").text(`Test date: ${input.scan?.CreatedAt ? new Date(input.scan.CreatedAt).toISOString().slice(0, 19).replace("T", " ") : "N/A"} UTC`, { align: "center" });
  doc.fontSize(10).fillColor("#555").text(`Report generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`, { align: "center" });
  doc.moveDown(2);

  if (!input.scan || input.scan.Status !== "Completed") {
    doc.fontSize(13).fillColor("#a16207").text(`No completed ${input.device.toLowerCase()} scan is available for this website yet.`, { align: "center" });
    doc.end();
    return done;
  }

  doc.fontSize(30).fillColor(scoreColor(input.scan.OverallScore)).text(`${input.scan.OverallScore ?? "N/A"} / 100`, { align: "center" });
  doc.fontSize(12).fillColor("#777").text("Overall Performance Score", { align: "center" });

  // =========================================================================
  // Score Breakdown
  // =========================================================================
  heading("Score Breakdown");
  drawHorizontalBar("Overall", input.scan.OverallScore);
  drawHorizontalBar("Core Web Vitals", input.scan.CoreWebVitalsScore);
  drawHorizontalBar("Server Response", input.scan.ServerResponseScore);
  drawHorizontalBar("Resource Optimization", input.scan.ResourceOptimizationScore);
  drawHorizontalBar("User Experience", input.scan.UserExperienceScore);

  // =========================================================================
  // Core Web Vitals & Timing
  // =========================================================================
  heading("Core Web Vitals & Timing");
  metricRow("Time to First Byte (TTFB)", fmtMs(input.scan.TtfbMs));
  metricRow("First Contentful Paint (FCP)", fmtMs(input.scan.FirstContentfulPaintMs));
  metricRow("Largest Contentful Paint (LCP)", fmtMs(input.scan.LargestContentfulPaintMs));
  metricRow("Cumulative Layout Shift (CLS)", input.scan.CumulativeLayoutShift === null ? "N/A" : input.scan.CumulativeLayoutShift.toFixed(3));
  metricRow("Total Blocking Time (TBT)", fmtMs(input.scan.TotalBlockingTimeMs));
  metricRow("Interaction to Next Paint (INP)", fmtMs(input.scan.InteractionToNextPaintMs));
  metricRow("Speed Index", fmtMs(input.scan.SpeedIndexMs));
  metricRow("Time to Interactive (TTI)", fmtMs(input.scan.TimeToInteractiveMs));
  metricRow("DOM Content Loaded", fmtMs(input.scan.DomContentLoadedMs));
  metricRow("Fully Loaded", fmtMs(input.scan.FullyLoadedMs));
  metricRow("HTTP Status Code", input.scan.HttpStatusCode === null ? "N/A" : String(input.scan.HttpStatusCode));
  metricRow("Redirects", input.scan.RedirectCount === null ? "N/A" : String(input.scan.RedirectCount));

  // =========================================================================
  // Resource Breakdown
  // =========================================================================
  heading("Resource Breakdown");
  if (!input.resources) {
    bodyText("No resource metrics recorded for this scan.", "#555");
  } else {
    const r = input.resources;
    metricRow("Total Requests", r.TotalRequests === null ? "N/A" : String(r.TotalRequests));
    metricRow("Total Transferred Size", fmtBytes(r.TotalTransferredBytes));
    metricRow("Total Uncompressed Size", fmtBytes(r.TotalUncompressedBytes));
    doc.moveDown(0.3);
    const byType: [string, number | null, number | null][] = [
      ["HTML", r.HtmlCount, r.HtmlBytes],
      ["CSS", r.CssCount, r.CssBytes],
      ["JavaScript", r.JsCount, r.JsBytes],
      ["Images", r.ImageCount, r.ImageBytes],
      ["Fonts", r.FontCount, r.FontBytes],
      ["Media", r.MediaCount, r.MediaBytes],
      ["Third-Party", r.ThirdPartyCount, r.ThirdPartyBytes],
    ];
    for (const [label, count, bytes] of byType) {
      metricRow(label, `${count ?? 0} request(s), ${fmtBytes(bytes)}`);
    }
    doc.moveDown(0.3);
    metricRow("Cached Requests", String(r.CachedCount ?? 0));
    metricRow("Failed Requests", String(r.FailedCount ?? 0));
    metricRow("Redirected Requests", String(r.RedirectedCount ?? 0));
    metricRow("Render-Blocking Resources", String(r.RenderBlockingCount ?? 0));
    metricRow("Estimated Unused CSS", fmtBytes(r.UnusedCssBytesEst));
    metricRow("Estimated Unused JS", fmtBytes(r.UnusedJsBytesEst));
    metricRow("Unoptimized Images", String(r.UnoptimizedImageCount ?? 0));
  }

  // =========================================================================
  // Optimization Checks
  // =========================================================================
  heading("Optimization Opportunities");
  if (input.checks.length === 0) {
    bodyText("No optimization checks recorded for this scan.", "#555");
  } else {
    for (const c of input.checks) {
      doc.fontSize(10).fillColor(c.Status === "Fail" || c.Status === "Warning" ? severityColor(c.Severity) : statusColor(c.Status)).text(`[${c.Status.toUpperCase()}] ${c.CheckName}`);
      doc.fontSize(8.5).fillColor("#333");
      if (c.Description) doc.text(c.Description);
      if (c.CurrentValueText || c.RecommendedValueText) {
        doc.text(`Current: ${c.CurrentValueText ?? "N/A"}   |   Recommended: ${c.RecommendedValueText ?? "N/A"}`);
      }
      if (c.EstimatedSavingsMs || c.EstimatedSavingsBytes) {
        doc.text(`Estimated savings: ${c.EstimatedSavingsMs ? fmtMs(c.EstimatedSavingsMs) : ""}${c.EstimatedSavingsMs && c.EstimatedSavingsBytes ? ", " : ""}${c.EstimatedSavingsBytes ? fmtBytes(c.EstimatedSavingsBytes) : ""}`);
      }
      if (c.Recommendation) doc.text(`Recommendation: ${c.Recommendation}`);
      if (c.AffectedResourceCount) doc.text(`Affected resources: ${c.AffectedResourceCount}`);
      doc.moveDown(0.35);
    }
  }

  // =========================================================================
  // Trend
  // =========================================================================
  if (doc.y > doc.page.height - 250) doc.addPage();
  heading("Performance Score Trend (Recent Scans)");
  drawTrendChart(input.history);

  // =========================================================================
  // Disclaimer
  // =========================================================================
  doc.moveDown(1);
  doc
    .fontSize(8)
    .fillColor("#777")
    .text(
      "This report reflects a single point-in-time test run using Google PageSpeed Insights (Lighthouse) plus this application's own resource-timing and optimization checks. Real-world visitor experience varies by network conditions, device, caching state, and geographic location.",
      { align: "left" }
    );

  doc.end();
  return done;
}
