import { getDb, sql } from "../db";
import { buildAlertMessage, sendMonitoringAlert } from "./notifications";

export type SlaWindow = "Daily" | "Weekly" | "Monthly";

// The start (UTC) of the current, still-in-progress evaluation period - SLA is tracked against
// "how am I doing so far this period", not a completed prior period, so a breach is caught as
// early as possible within the window rather than only after it closes.
export function getSlaPeriodStart(window: SlaWindow, now: Date): Date {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  if (window === "Monthly") return new Date(Date.UTC(y, m, 1));
  if (window === "Weekly") {
    // ISO-ish week start: Monday. getUTCDay() is 0=Sun..6=Sat; days-since-Monday handles Sunday (0) as 6.
    const daysSinceMonday = (now.getUTCDay() + 6) % 7;
    return new Date(Date.UTC(y, m, d - daysSinceMonday));
  }
  return new Date(Date.UTC(y, m, d));
}

export interface SlaBreachDecision {
  shouldAlert: boolean;
}

// Dedup, same shape as sslEvaluator.ts's threshold dedup: a monitor sitting below target for an
// entire period only ever alerts once for that exact period (lastBreachedPeriodStart tracks
// which period was last alerted) - once the period rolls over, a fresh breach in the new period
// alerts again.
export function evaluateSlaBreach(actualPercent: number, targetPercent: number, periodStart: Date, lastBreachedPeriodStart: Date | null): SlaBreachDecision {
  if (actualPercent >= targetPercent) return { shouldAlert: false };
  const alreadyAlertedThisPeriod = lastBreachedPeriodStart !== null && lastBreachedPeriodStart.getTime() >= periodStart.getTime();
  return { shouldAlert: !alreadyAlertedThisPeriod };
}

interface SlaConfigRow {
  MonitorId: number;
  TargetPercent: number;
  EvaluationWindow: SlaWindow;
  LastBreachedPeriodStart: Date | null;
  MonitorName: string;
  MonitorUrl: string;
  AlertPolicyId: number | null;
  AlertEmail: string | null;
}

// Checked once per scan pass (like escalation/retry), against every monitor that has an
// SlaConfigurations row - independent of which monitors happened to be "due" this particular
// pass, since a breach is about the period as a whole, not this one check.
export async function processSlaBreaches(): Promise<void> {
  const db = await getDb();
  const configs = await db.query<SlaConfigRow>(`
    SELECT s.MonitorId, s.TargetPercent, s.EvaluationWindow, s.LastBreachedPeriodStart,
      m.Name AS MonitorName, m.AlertPolicyId,
      COALESCE(w.Url, a.Url) AS MonitorUrl,
      COALESCE(w.AlertEmail, a.AlertEmail) AS AlertEmail
    FROM SlaConfigurations s
    JOIN Monitors m ON m.Id = s.MonitorId AND m.IsDeleted = 0
    LEFT JOIN WebsiteMonitorConfigs w ON w.MonitorId = m.Id
    LEFT JOIN ApiMonitorConfigs a ON a.MonitorId = m.Id
  `);

  const now = new Date();
  for (const config of configs.recordset) {
    const periodStart = getSlaPeriodStart(config.EvaluationWindow, now);
    const uptime = await db
      .request()
      .input("id", sql.Int, config.MonitorId)
      .input("start", sql.DateTime2, periodStart)
      .query<{ Total: number; Successful: number }>(
        "SELECT COUNT(*) AS Total, SUM(CASE WHEN Success = 1 THEN 1 ELSE 0 END) AS Successful FROM MonitorResults WHERE MonitorId = @id AND CheckedAt >= @start"
      );
    const row = uptime.recordset[0];
    if (!row || row.Total === 0) continue; // nothing checked yet this period - nothing to evaluate

    const actualPercent = (row.Successful / row.Total) * 100;
    const decision = evaluateSlaBreach(actualPercent, config.TargetPercent, periodStart, config.LastBreachedPeriodStart);
    if (!decision.shouldAlert) continue;

    await db.request().input("id", sql.Int, config.MonitorId).input("periodStart", sql.DateTime2, periodStart).query("UPDATE SlaConfigurations SET LastBreachedPeriodStart = @periodStart WHERE MonitorId = @id");

    const reason = `${actualPercent.toFixed(3)}% uptime so far this ${config.EvaluationWindow.toLowerCase()} period, below the ${config.TargetPercent}% target.`;
    const msg = buildAlertMessage("SlaBreach", config.MonitorName, config.MonitorUrl, reason);
    await sendMonitoringAlert({
      eventType: "SlaBreach",
      alertPolicyId: config.AlertPolicyId,
      monitorAlertEmail: config.AlertEmail,
      monitorId: config.MonitorId,
      incidentId: null,
      subject: msg.subject,
      body: msg.body,
    });
  }
}
