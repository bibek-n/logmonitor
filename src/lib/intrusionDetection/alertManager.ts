import { getDb, sql } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/notifyEmail";
import { getModuleRecipients } from "@/lib/notificationRecipients";
import type { RuleMatch } from "./ruleEngine";
import { computeRiskScore, explainRiskScore, buildEvidenceSummary } from "./riskScoring";
import { sanitizeEvidence } from "./redaction";
import type { NormalizedSecurityEvent, Severity } from "./shared";

const NOTIFY_SEVERITIES: Severity[] = ["high", "critical"];

function buildGroupingKey(template: string, ruleKey: string, event: NormalizedSecurityEvent): string {
  return template.replace("{ruleKey}", ruleKey).replace("{sourceIp}", event.sourceIp ?? "unknown").replace("{userAccount}", event.userAccount ?? "unknown");
}

async function getIpAlertCount(ip: string | null): Promise<number> {
  if (!ip) return 0;
  const db = await getDb();
  const result = await db.request().input("ip", sql.VarChar, ip).query<{ Cnt: number }>(`SELECT TotalAlerts AS Cnt FROM SecurityIpProfiles WHERE IpAddress = @ip`);
  return result.recordset[0]?.Cnt ?? 0;
}

async function isSourceIpAllowlisted(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const db = await getDb();
  const result = await db.request().input("ip", sql.VarChar, ip).query<{ Cnt: number }>(`
    SELECT COUNT(*) AS Cnt FROM SecurityIpAllowlist WHERE IpOrCidr = @ip AND (ExpiresAt IS NULL OR ExpiresAt > SYSUTCDATETIME())
  `);
  return (result.recordset[0]?.Cnt ?? 0) > 0;
}

// Processes one rule match: either folds it into an existing open alert within its cooldown
// window (dedup/grouping - "Duplicate events are grouped", "Alert cooldown periods"), or
// creates a brand new alert. Returns the alert Id either way so the caller can link the
// triggering SecurityEvents row to it.
export async function processMatch(match: RuleMatch, event: NormalizedSecurityEvent, eventId: number): Promise<number | null> {
  if (await isSourceIpAllowlisted(event.sourceIp)) return null;

  const db = await getDb();
  const groupingKey = buildGroupingKey(match.rule.GroupingKeyTemplate, match.rule.RuleKey, event);

  const existing = await db.request().input("groupingKey", sql.NVarChar, groupingKey).query<{ Id: number; LastSeenAt: string; Status: string }>(`
    SELECT TOP 1 Id, LastSeenAt, Status FROM SecurityAlerts
    WHERE GroupingKey = @groupingKey AND Status NOT IN ('Resolved', 'FalsePositive')
    ORDER BY LastSeenAt DESC
  `);

  const cooldownMs = match.rule.CooldownSeconds * 1000;
  const withinCooldown = existing.recordset[0] && Date.now() - new Date(existing.recordset[0].LastSeenAt).getTime() < cooldownMs;

  if (existing.recordset[0] && withinCooldown) {
    const alertId = existing.recordset[0].Id;
    await db
      .request()
      .input("id", sql.Int, alertId)
      .input("lastSeenAt", sql.DateTime2, new Date(event.eventTime))
      .query(`UPDATE SecurityAlerts SET LastSeenAt = @lastSeenAt, OccurrenceCount = OccurrenceCount + 1, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id`);
    return alertId;
  }

  const priorAlertCount = await getIpAlertCount(event.sourceIp);
  const risk = computeRiskScore({
    severity: match.rule.Severity,
    confidence: match.rule.Confidence,
    category: match.rule.Category,
    occurrenceCount: match.occurrenceCount,
    priorAlertCountForIp: priorAlertCount,
  });

  const evidence = sanitizeEvidence(buildEvidenceSummary(match, event.evidenceSummary));
  const recommendedAction = `${match.rule.RecommendedAction ?? ""} (${explainRiskScore(risk)})`.trim();

  const insertResult = await db
    .request()
    .input("ruleId", sql.Int, match.rule.Id)
    .input("appId", sql.Int, event.protectedApplicationId)
    .input("category", sql.VarChar, match.rule.Category)
    .input("severity", sql.VarChar, match.rule.Severity)
    .input("confidence", sql.Int, match.rule.Confidence)
    .input("riskScore", sql.Int, risk.score)
    .input("sourceIp", sql.VarChar, event.sourceIp)
    .input("destinationHost", sql.NVarChar, event.destinationHost)
    .input("requestMethod", sql.VarChar, event.requestMethod)
    .input("requestPath", sql.NVarChar, event.requestPath)
    .input("responseStatus", sql.Int, event.responseStatus)
    .input("userAgent", sql.NVarChar, event.userAgent)
    .input("userAccount", sql.NVarChar, event.userAccount)
    .input("evidenceSummary", sql.NVarChar, evidence)
    .input("recommendedAction", sql.NVarChar, recommendedAction)
    .input("groupingKey", sql.NVarChar, groupingKey)
    .input("firstSeenAt", sql.DateTime2, new Date(event.eventTime))
    .input("lastSeenAt", sql.DateTime2, new Date(event.eventTime))
    .query<{ Id: number }>(`
      INSERT INTO SecurityAlerts
        (RuleId, ProtectedApplicationId, Category, Severity, Confidence, RiskScore, SourceIp, DestinationHost, RequestMethod, RequestPath, ResponseStatus, UserAgent, UserAccount, EvidenceSummary, RecommendedAction, GroupingKey, FirstSeenAt, LastSeenAt)
      OUTPUT INSERTED.Id
      VALUES
        (@ruleId, @appId, @category, @severity, @confidence, @riskScore, @sourceIp, @destinationHost, @requestMethod, @requestPath, @responseStatus, @userAgent, @userAccount, @evidenceSummary, @recommendedAction, @groupingKey, @firstSeenAt, @lastSeenAt)
    `);

  const alertId = insertResult.recordset[0].Id;

  await db
    .request()
    .input("alertId", sql.Int, alertId)
    .input("newStatus", sql.VarChar, "New")
    .query(`INSERT INTO SecurityAlertStatusHistory (AlertId, OldStatus, NewStatus, Reason) VALUES (@alertId, NULL, @newStatus, 'Created by detection engine')`);

  if (event.sourceIp) {
    await db.request().input("ip", sql.VarChar, event.sourceIp).query(`UPDATE SecurityIpProfiles SET TotalAlerts = TotalAlerts + 1 WHERE IpAddress = @ip`);
  }

  await db.request().input("id", sql.Int, eventId).input("alertId", sql.Int, alertId).query(`UPDATE SecurityEvents SET AlertId = @alertId WHERE Id = @id`);

  if (NOTIFY_SEVERITIES.includes(match.rule.Severity)) {
    void notifyNewAlert(alertId, match, event, risk.score).catch((err) => {
      console.error(`[intrusion-detection] failed to send alert notification for alert ${alertId}:`, err instanceof Error ? err.message : err);
    });
  }

  return alertId;
}

async function notifyNewAlert(alertId: number, match: RuleMatch, event: NormalizedSecurityEvent, riskScore: number): Promise<void> {
  const recipients = await getModuleRecipients("intrusion-detection");
  if (!recipients) return; // Not configured/disabled in Settings > Notifications - nothing to send.

  const subject = `[${match.rule.Severity.toUpperCase()}] ${match.rule.Name} - Intrusion Detection Alert #${alertId}`;
  const body = [
    `A new ${match.rule.Severity} severity alert was created by the Intrusion Detection System.`,
    ``,
    `Rule: ${match.rule.Name}`,
    `Category: ${match.rule.Category}`,
    `Risk score: ${riskScore}/100`,
    `Source IP: ${event.sourceIp ?? "unknown"}`,
    `Target: ${event.requestPath ?? event.destinationHost ?? "unknown"}`,
    `Time: ${event.eventTime}`,
    `Why: ${match.reason}`,
    ``,
    `Recommended action: ${match.rule.RecommendedAction ?? "Review the alert in the Security Dashboard."}`,
  ].join("\n");

  await sendNotificationEmail({ to: recipients, subject, body });
}
