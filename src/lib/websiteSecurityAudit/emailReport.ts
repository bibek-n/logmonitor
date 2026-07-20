import { getDb, sql } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/notifyEmail";
import { loadScanDetail, type ScanDetail } from "./scanDetail";
import { getOrGenerateAuditPdf } from "./generatePdf";

// Documented default recipients per the feature spec — the real env var is set on the
// server only (this repo is public; see project_logmonitor_public_repo memory).
const DEFAULT_RECIPIENTS = "bibek@tulipstechnologies.com, support@websearchpro.net";
const RECIPIENTS = process.env.WEBSITE_AUDIT_REPORT_RECIPIENTS || DEFAULT_RECIPIENTS;

function severityCounts(detail: ScanDetail): Record<string, number> {
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of [...detail.findings, ...detail.dependencyFindings, ...detail.codeFindings]) {
    counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  }
  return counts;
}

function buildEmailBody(detail: ScanDetail): string {
  const counts = severityCounts(detail);
  const sslFindings = detail.findings.filter((f) => f.category === "weak_tls");
  const sslStatus = sslFindings.length === 0 ? "Healthy" : sslFindings.map((f) => f.title).join("; ");
  const topFindings = [...detail.findings]
    .sort((a, b) => {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
    })
    .slice(0, 5);

  const lines = [
    `Website: ${detail.websiteName}`,
    `URL: ${detail.websiteUrl}`,
    `Scan date: ${detail.scanDate}`,
    `Overall score: ${detail.securityScore} / 100`,
    `Risk level: ${detail.riskLevel}`,
    "",
    `Findings by severity — Critical: ${counts.critical}, High: ${counts.high}, Medium: ${counts.medium}, Low: ${counts.low}`,
    `SSL/TLS status: ${sslStatus}`,
    "",
    "Main findings:",
    ...(topFindings.length > 0 ? topFindings.map((f) => `  - [${f.severity.toUpperCase()}] ${f.title}`) : ["  (none)"]),
    "",
    "Recommended immediate actions:",
    ...(detail.recommendations.length > 0 ? detail.recommendations.slice(0, 5).map((r) => `  - ${r}`) : ["  (none — no material issues detected)"]),
    "",
    "Full detail, including package/code risks and scan limitations, is in the attached PDF report.",
    "",
    "This scan used safe, non-destructive checks only. No brute-force, password, denial-of-service, or destructive",
    "testing was performed. Any secret detected is masked in this email, the dashboard, and the PDF.",
  ];
  return lines.join("\n");
}

async function logEmailAttempt(scanId: number, subject: string, success: boolean, errorMessage?: string): Promise<void> {
  const db = await getDb();
  for (const recipient of RECIPIENTS.split(",").map((r) => r.trim()).filter(Boolean)) {
    await db
      .request()
      .input("scanId", sql.Int, scanId)
      .input("to", sql.NVarChar, recipient)
      .input("subject", sql.NVarChar, subject)
      .input("success", sql.Bit, success)
      .input("errorMessage", sql.NVarChar, errorMessage ?? null)
      .query(
        "INSERT INTO WebsiteAuditEmailLogs (ScanId, ToAddress, Subject, Success, ErrorMessage) VALUES (@scanId, @to, @subject, @success, @errorMessage)"
      );
  }
}

// Shared by the daily scheduled scan and the manual "Scan now" flow — previously only the
// daily script sent this report email, so a manually-triggered scan silently produced no
// email at all even though the PDF/report existed. Never throws: a broken report email
// shouldn't undo an otherwise-successful scan, so failures are logged to
// WebsiteAuditEmailLogs the same way a rejected send is.
export async function sendScanReportEmail(scanId: number, subjectPrefix: string): Promise<void> {
  const detail = await loadScanDetail(scanId);
  if (!detail || detail.status !== "Completed") return;

  try {
    const { buffer: pdfBuffer, filename } = await getOrGenerateAuditPdf(scanId, detail);
    const subject = `${subjectPrefix} – ${detail.websiteName} – ${detail.scanDate}`;
    const body = buildEmailBody(detail);

    const sendResult = await sendNotificationEmail({
      to: RECIPIENTS,
      subject,
      body,
      attachments: [{ filename, content: pdfBuffer, contentType: "application/pdf" }],
    });
    await logEmailAttempt(scanId, subject, sendResult.success, sendResult.error);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEmailAttempt(scanId, `${subjectPrefix} – ${detail.websiteName} – ${detail.scanDate}`, false, message);
  }
}
