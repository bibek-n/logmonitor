import { getDb, sql } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/notifyEmail";
import { getModuleRecipients } from "@/lib/notificationRecipients";
import type { Finding, RiskLevel } from "./types";

const SCORE_DROP_THRESHOLD = 15;
const RISK_RANK: Record<RiskLevel, number> = { Low: 0, Medium: 1, High: 2, Critical: 3 };

interface PreviousScanRow {
  SecurityScore: number | null;
  RiskLevel: string | null;
}

// Separate from sendScanReportEmail (which fires on every completed scan, success or not) -
// this only fires when something actually got worse, so it can go to a narrower/more urgent
// recipient list (e.g. on-call) without flooding it with routine "scan completed, nothing
// changed" noise the way the scan-complete notification does.
export async function checkAndSendScoreDropAlert(
  websiteId: number,
  securityScore: number,
  riskLevel: RiskLevel,
  findings: Finding[]
): Promise<void> {
  const recipients = await getModuleRecipients("website-audit", "score-drop");
  if (!recipients) return;

  const db = await getDb();
  const websiteResult = await db.request().input("websiteId", sql.Int, websiteId).query<{ Name: string; Url: string }>(
    "SELECT Name, Url FROM Websites WHERE Id = @websiteId"
  );
  const website = websiteResult.recordset[0];
  if (!website) return;
  const scanDate = new Date().toISOString().slice(0, 10);

  const prevResult = await db
    .request()
    .input("websiteId", sql.Int, websiteId)
    .input("scanDate", sql.Date, scanDate)
    .query<PreviousScanRow>(`
      SELECT TOP 1 SecurityScore, RiskLevel FROM WebsiteAuditScans
      WHERE WebsiteId = @websiteId AND ScanDate < @scanDate AND Status = 'Completed'
      ORDER BY ScanDate DESC
    `);
  const prev = prevResult.recordset[0];
  if (!prev || prev.SecurityScore === null) return; // First scan ever - nothing to compare against.

  const scoreDelta = securityScore - prev.SecurityScore;
  const riskWorsened = RISK_RANK[riskLevel] > RISK_RANK[(prev.RiskLevel ?? "Low") as RiskLevel];
  const newCritical = findings.filter((f) => f.severity === "critical");

  const reasons: string[] = [];
  if (scoreDelta <= -SCORE_DROP_THRESHOLD) reasons.push(`Security score dropped by ${Math.abs(scoreDelta)} points (${prev.SecurityScore} -> ${securityScore}).`);
  if (riskWorsened) reasons.push(`Risk level worsened from ${prev.RiskLevel} to ${riskLevel}.`);
  if (newCritical.length > 0) reasons.push(`${newCritical.length} critical-severity finding(s) in this scan: ${newCritical.map((f) => f.title).join("; ")}`);

  if (reasons.length === 0) return;

  const body = [
    `Website: ${website.Name}`,
    `URL: ${website.Url}`,
    `Scan date: ${scanDate}`,
    "",
    "This alert fired because:",
    ...reasons.map((r) => `  - ${r}`),
    "",
    `Current score: ${securityScore}/100 (${riskLevel} risk) — previous: ${prev.SecurityScore}/100 (${prev.RiskLevel ?? "unknown"} risk).`,
    "",
    "See the Website Security Audit dashboard for full details, or use \"Compare scans\" there to see exactly what changed.",
  ].join("\n");

  try {
    await sendNotificationEmail({ to: recipients, subject: `[ALERT] ${website.Name} security score dropped — ${riskLevel} risk`, body });
  } catch (err) {
    console.error("[scoreDropAlert] failed to send alert email:", err instanceof Error ? err.message : err);
  }
}
