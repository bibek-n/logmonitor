import "dotenv/config";
import { getDb, sql } from "../src/lib/db";
import { sendNotificationEmail } from "../src/lib/notifyEmail";
import { getModuleRecipients } from "../src/lib/notificationRecipients";

// Run once a month (see run-monthly-security-digest.ps1 / the registered scheduled task) -
// one consolidated email across every enabled website, separate from the per-scan "Scan
// Complete" report (which fires daily per site and would be far too noisy as a monthly
// subscription on its own). Opt-in: see Settings > Notifications, "Website Security Audit /
// Monthly Digest" - sends nothing until an admin configures recipients there.
async function main() {
  // Self-gated on top of the scheduled task's own monthly trigger (same belt-and-suspenders
  // pattern as run-website-security-daily-scan.ts checking its own due-ness) - if the task
  // is ever misconfigured to fire more often, this still only actually sends once per month.
  if (new Date().getUTCDate() !== 1) {
    console.log("[monthly-digest] not the 1st of the month - skipping.");
    process.exit(0);
  }

  const recipients = await getModuleRecipients("website-audit", "monthly-digest");
  if (!recipients) {
    console.log("[monthly-digest] no recipients configured for website-audit/monthly-digest - skipping.");
    process.exit(0);
  }

  const db = await getDb();
  const result = await db.query<{
    Id: number;
    Name: string;
    Url: string;
    LatestScore: number | null;
    LatestRisk: string | null;
    LatestScanDate: string | null;
    ScoreMonthAgo: number | null;
  }>(`
    SELECT w.Id, w.Name, w.Url,
      latest.SecurityScore AS LatestScore, latest.RiskLevel AS LatestRisk, latest.ScanDate AS LatestScanDate,
      monthAgo.SecurityScore AS ScoreMonthAgo
    FROM Websites w
    OUTER APPLY (
      SELECT TOP 1 SecurityScore, RiskLevel, ScanDate FROM WebsiteAuditScans
      WHERE WebsiteId = w.Id AND Status = 'Completed'
      ORDER BY ScanDate DESC, Id DESC
    ) latest
    OUTER APPLY (
      SELECT TOP 1 SecurityScore FROM WebsiteAuditScans
      WHERE WebsiteId = w.Id AND Status = 'Completed' AND ScanDate <= DATEADD(day, -28, CAST(SYSUTCDATETIME() AS DATE))
      ORDER BY ScanDate DESC
    ) monthAgo
    WHERE w.Enabled = 1
    ORDER BY w.Name
  `);

  const rows = result.recordset;
  const scanned = rows.filter((r) => r.LatestScore !== null);
  const unscanned = rows.filter((r) => r.LatestScore === null);
  const critical = scanned.filter((r) => r.LatestRisk === "Critical");
  const high = scanned.filter((r) => r.LatestRisk === "High");
  const avgScore = scanned.length > 0 ? Math.round(scanned.reduce((sum, r) => sum + (r.LatestScore ?? 0), 0) / scanned.length) : null;

  function trendLabel(row: (typeof rows)[number]): string {
    if (row.LatestScore === null || row.ScoreMonthAgo === null) return "";
    const delta = row.LatestScore - row.ScoreMonthAgo;
    if (delta === 0) return " (no change vs 4 weeks ago)";
    return ` (${delta > 0 ? "+" : ""}${delta} vs 4 weeks ago)`;
  }

  const lines = [
    `Monthly Website Security Digest — ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long" })}`,
    "",
    `Websites monitored: ${rows.length} | Average score: ${avgScore ?? "n/a"}/100`,
    `Critical risk: ${critical.length} | High risk: ${high.length} | Never scanned: ${unscanned.length}`,
    "",
    "Per-website summary:",
    ...scanned
      .sort((a, b) => (a.LatestScore ?? 0) - (b.LatestScore ?? 0))
      .map((r) => `  - ${r.Name}: ${r.LatestScore}/100, ${r.LatestRisk} risk${trendLabel(r)} (last scan ${r.LatestScanDate ? new Date(r.LatestScanDate).toLocaleDateString() : "unknown"})`),
  ];

  if (unscanned.length > 0) {
    lines.push("", "Never scanned (check the website's enabled/schedule settings):", ...unscanned.map((r) => `  - ${r.Name} (${r.Url})`));
  }

  lines.push("", "Full per-site detail, including findings and remediation steps, is available in the Website Security Audit dashboard.");

  await sendNotificationEmail({
    to: recipients,
    subject: `Monthly Website Security Digest — ${rows.length} sites, avg score ${avgScore ?? "n/a"}/100`,
    body: lines.join("\n"),
  });

  console.log(`[monthly-digest] sent to ${recipients} covering ${rows.length} website(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
