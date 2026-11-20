import PDFDocument from "pdfkit";
import type { IncidentDetail } from "./repository";

// Pure JS, no native bindings - same pdfkit convention already established in this app
// (src/lib/websiteSecurityAudit/generatePdf.ts, src/lib/websiteApiMonitoring/reportExport.ts).
// Deliberately plain (title + key/value rows + text sections) rather than that audit report's
// multi-section/chart machinery - a post-incident summary is a short document, not a
// comprehensive scan report.
function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return "Ongoing";
  const minutes = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export async function generateIncidentSummaryPdf(incident: IncidentDetail): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.fontSize(20).text("Post-Incident Summary", { align: "left" });
  doc.moveDown(0.3);
  doc.fontSize(14).fillColor("#333").text(incident.title);
  doc.moveDown(0.8);

  doc.fontSize(10).fillColor("#000");
  const rows: [string, string][] = [
    ["Severity", incident.severity],
    ["Status", incident.status],
    ["Affected System", incident.affectedSystem ?? "-"],
    ["Owner", incident.ownerUsername ?? "Unassigned"],
    ["Started", new Date(incident.startedAt).toLocaleString()],
    ["Acknowledged", incident.acknowledgedAt ? `${new Date(incident.acknowledgedAt).toLocaleString()} by ${incident.acknowledgedByUsername ?? "-"}` : "Not yet acknowledged"],
    ["Resolved", incident.resolvedAt ? `${new Date(incident.resolvedAt).toLocaleString()} by ${incident.resolvedByUsername ?? "-"}` : "Not yet resolved"],
    ["Duration", formatDuration(incident.startedAt, incident.resolvedAt)],
  ];
  for (const [label, value] of rows) {
    doc.font("Helvetica-Bold").text(`${label}: `, { continued: true }).font("Helvetica").text(value);
  }

  function section(title: string, body: string | null) {
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(12).text(title);
    doc.font("Helvetica").fontSize(10).text(body?.trim() || "Not recorded.");
  }
  section("Root Cause", incident.rootCause);
  section("Fix", incident.fix);
  section("Prevention", incident.prevention);

  if (incident.linkedAlerts.length > 0 || incident.linkedMonitorIncidents.length > 0) {
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(12).text("Linked Alerts & Incidents");
    doc.font("Helvetica").fontSize(9);
    for (const a of incident.linkedAlerts) doc.text(`Security Alert #${a.id} - ${a.category} (${a.severity}) - ${a.status}`);
    for (const m of incident.linkedMonitorIncidents) doc.text(`Monitor Incident #${m.id} - ${m.monitorName} (${m.severity}) - ${m.status}`);
  }

  if (incident.timeline.length > 0) {
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(12).text("Timeline");
    doc.font("Helvetica").fontSize(9);
    for (const t of incident.timeline) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 20) doc.addPage();
      doc.text(`${new Date(t.createdAt).toLocaleString()} - ${t.username ?? "System"} - ${t.message}`);
    }
  }

  doc.end();
  return done;
}
