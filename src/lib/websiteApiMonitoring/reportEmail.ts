import type { WebsiteMonitorReportRow } from "./repository";

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max - 1) + "…" : value;
}

function col(value: string, width: number): string {
  return truncate(value, width).padEnd(width);
}

// notifyEmail.ts only ever sends text/plain (see buildMessage in notifyEmail.ts) - this table
// is hand-aligned with fixed-width columns rather than HTML, matching every other monitoring
// notification in this module (buildAlertMessage in notifications.ts is plain text too).
export function buildMonitorReportEmail(rows: WebsiteMonitorReportRow[], generatedAt: Date): { subject: string; body: string } {
  const subject = `Website Monitor Report - ${rows.length} monitor${rows.length === 1 ? "" : "s"} - ${generatedAt.toISOString().slice(0, 10)}`;

  if (rows.length === 0) {
    return { subject, body: `Website Monitor Report\nGenerated: ${generatedAt.toUTCString()}\n\nNo website monitors are configured yet.` };
  }

  const columns = [
    { header: "Name", width: 28, get: (r: WebsiteMonitorReportRow) => r.name },
    { header: "URL", width: 40, get: (r: WebsiteMonitorReportRow) => r.url },
    { header: "Status", width: 10, get: (r: WebsiteMonitorReportRow) => r.status },
    { header: "Uptime 7d", width: 10, get: (r: WebsiteMonitorReportRow) => (r.uptimePercent7d === null ? "-" : `${r.uptimePercent7d.toFixed(2)}%`) },
    { header: "Last Resp.", width: 11, get: (r: WebsiteMonitorReportRow) => (r.lastResponseMs === null ? "-" : `${r.lastResponseMs} ms`) },
    { header: "Last Checked (UTC)", width: 20, get: (r: WebsiteMonitorReportRow) => (r.lastCheckedAt ? r.lastCheckedAt.replace("T", " ").slice(0, 19) : "-") },
    { header: "Open Inc.", width: 9, get: (r: WebsiteMonitorReportRow) => String(r.openIncidents) },
  ];

  const headerLine = columns.map((c) => col(c.header, c.width)).join(" | ");
  const separatorLine = columns.map((c) => "-".repeat(c.width)).join("-+-");
  const dataLines = rows.map((r) => columns.map((c) => col(c.get(r), c.width)).join(" | "));

  const upCount = rows.filter((r) => r.status === "Up").length;
  const downCount = rows.filter((r) => r.status === "Down").length;
  const otherCount = rows.length - upCount - downCount;

  const body = [
    "Website Monitor Report",
    `Generated: ${generatedAt.toUTCString()}`,
    `Monitors: ${rows.length}  |  Up: ${upCount}  |  Down: ${downCount}  |  Other: ${otherCount}`,
    "",
    headerLine,
    separatorLine,
    ...dataLines,
    "",
    "This report was sent on request from the Website & API Monitoring dashboard.",
  ].join("\n");

  return { subject, body };
}
