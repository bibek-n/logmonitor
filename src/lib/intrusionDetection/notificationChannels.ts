import { getDb, sql } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/notifyEmail";
import { sendSlackAlert, sendTeamsAlert, sendWebhookAlert, sendInAppAlert, type ChannelSendResult } from "@/lib/websiteApiMonitoring/alertChannels";
import { isWithinQuietHours } from "@/lib/websiteApiMonitoring/quietHours";
import { encryptIdsSecret, decryptIdsSecret } from "./secretCrypto";
import { severityRank, type Severity } from "./shared";

// Reuses the exact Slack/Teams/Webhook/In-App senders already built for Website & API
// Monitoring (src/lib/websiteApiMonitoring/alertChannels.ts) rather than re-implementing them -
// those functions are generic (webhookUrl/subject/body in, success/error out) and carry no
// website-monitoring-specific assumptions. Email continues to use this app's one hand-rolled
// raw-SMTP sender (src/lib/notifyEmail.ts) - nodemailer is avoided everywhere in this app due
// to a known crash on this Windows/iisnode host.

export type ChannelType = "slack" | "teams" | "webhook" | "email" | "in_app";

export const CHANNEL_TYPES: ChannelType[] = ["slack", "teams", "webhook", "email", "in_app"];

interface SlackTeamsConfig {
  webhookUrl: string;
}
interface WebhookConfig {
  url: string;
  signingSecret?: string | null;
}
interface EmailConfig {
  to: string;
}
interface InAppConfig {
  username: string;
}

export type ChannelConfig = SlackTeamsConfig | WebhookConfig | EmailConfig | InAppConfig;

export interface NotificationChannelRow {
  id: number;
  channelType: ChannelType;
  name: string;
  enabled: boolean;
  minSeverity: Severity;
  createdAt: string;
  hasConfig: boolean;
}

interface ChannelDbRow {
  Id: number;
  ChannelType: string;
  Name: string;
  EncryptedConfig: string | null;
  Enabled: boolean;
  MinSeverity: string;
  CreatedAt: string;
}

function toRow(r: ChannelDbRow): NotificationChannelRow {
  return {
    id: r.Id,
    channelType: r.ChannelType as ChannelType,
    name: r.Name,
    enabled: r.Enabled,
    minSeverity: r.MinSeverity as Severity,
    createdAt: r.CreatedAt,
    hasConfig: r.EncryptedConfig !== null,
  };
}

// Config is decrypted only for internal dispatch/test use - never returned from a list/get API
// response (see notification-channels/route.ts), so a compromised admin session can't exfiltrate
// webhook URLs/signing secrets just by viewing the settings page.
function decryptConfig(encrypted: string | null): ChannelConfig | null {
  if (!encrypted) return null;
  try {
    return JSON.parse(decryptIdsSecret(encrypted)) as ChannelConfig;
  } catch {
    return null;
  }
}

export async function listChannels(): Promise<NotificationChannelRow[]> {
  const db = await getDb();
  const result = await db.query<ChannelDbRow>("SELECT * FROM SecurityNotificationChannels ORDER BY CreatedAt DESC");
  return result.recordset.map(toRow);
}

export async function createChannel(input: { channelType: ChannelType; name: string; config: ChannelConfig; minSeverity: Severity }): Promise<number> {
  const db = await getDb();
  const encrypted = encryptIdsSecret(JSON.stringify(input.config));
  const result = await db
    .request()
    .input("channelType", sql.VarChar, input.channelType)
    .input("name", sql.NVarChar, input.name)
    .input("config", sql.NVarChar, encrypted)
    .input("minSeverity", sql.VarChar, input.minSeverity)
    .query<{ Id: number }>(`
      INSERT INTO SecurityNotificationChannels (ChannelType, Name, EncryptedConfig, MinSeverity)
      OUTPUT INSERTED.Id
      VALUES (@channelType, @name, @config, @minSeverity)
    `);
  return result.recordset[0].Id;
}

export async function updateChannel(id: number, patch: { name?: string; enabled?: boolean; minSeverity?: Severity; config?: ChannelConfig }): Promise<void> {
  const db = await getDb();
  const req = db.request().input("id", sql.Int, id);
  const sets: string[] = [];
  if (patch.name !== undefined) {
    sets.push("Name = @name");
    req.input("name", sql.NVarChar, patch.name);
  }
  if (patch.enabled !== undefined) {
    sets.push("Enabled = @enabled");
    req.input("enabled", sql.Bit, patch.enabled);
  }
  if (patch.minSeverity !== undefined) {
    sets.push("MinSeverity = @minSeverity");
    req.input("minSeverity", sql.VarChar, patch.minSeverity);
  }
  if (patch.config !== undefined) {
    sets.push("EncryptedConfig = @config");
    req.input("config", sql.NVarChar, encryptIdsSecret(JSON.stringify(patch.config)));
  }
  if (sets.length === 0) return;
  await req.query(`UPDATE SecurityNotificationChannels SET ${sets.join(", ")} WHERE Id = @id`);
}

export async function deleteChannel(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query("DELETE FROM SecurityNotificationChannels WHERE Id = @id");
}

async function recordDelivery(
  alertId: number | null,
  channelId: number | null,
  channelType: ChannelType,
  result: ChannelSendResult,
  statusOverride?: "Suppressed"
): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("alertId", sql.Int, alertId)
    .input("channelId", sql.Int, channelId)
    .input("channelType", sql.VarChar, channelType)
    .input("status", sql.VarChar, statusOverride ?? (result.success ? "Sent" : "Failed"))
    .input("errorMessage", sql.NVarChar, result.error)
    .query(`
      INSERT INTO SecurityNotificationDeliveries (AlertId, ChannelId, ChannelType, Status, ErrorMessage)
      VALUES (@alertId, @channelId, @channelType, @status, @errorMessage)
    `);
}

async function sendToChannel(channelType: ChannelType, config: ChannelConfig, subject: string, body: string): Promise<ChannelSendResult> {
  switch (channelType) {
    case "slack":
      return sendSlackAlert((config as SlackTeamsConfig).webhookUrl, subject, body);
    case "teams":
      return sendTeamsAlert((config as SlackTeamsConfig).webhookUrl, subject, body);
    case "webhook": {
      const c = config as WebhookConfig;
      // monitorId is a website-api-monitoring-specific field on the shared payload shape -
      // IDS alerts aren't tied to a monitor, so it's sent as 0 (a documented non-null sentinel,
      // not a real id) rather than widening that module's payload type just for this caller.
      return sendWebhookAlert(c.url, { signingSecret: c.signingSecret ?? null }, { eventType: "intrusion_detection_alert", subject, body, monitorId: 0, incidentId: null });
    }
    case "email": {
      const result = await sendNotificationEmail({ to: (config as EmailConfig).to, subject, body });
      return { success: result.success, error: result.error ?? null };
    }
    case "in_app":
      return sendInAppAlert((config as InAppConfig).username, { eventType: "intrusion_detection_alert", subject, body, monitorId: null, incidentId: null });
    default:
      return { success: false, error: `Unknown channel type: ${channelType}` };
  }
}

export interface AlertNotificationPayload {
  alertId: number;
  severity: Severity;
  subject: string;
  body: string;
}

interface NotificationSettingsRow {
  Id: number;
  QuietHoursEnabled: boolean;
  QuietHoursStart: string | null;
  QuietHoursEnd: string | null;
  QuietHoursTimezone: string;
  QuietHoursAllowCritical: boolean;
  EscalationEnabled: boolean;
  DigestEnabled: boolean;
  DigestHour: number;
  DigestChannelId: number | null;
  LastDigestSentAt: string | null;
}

// Exactly one row ever exists (seeded by the migration) - every caller just reads/writes it.
async function getSettingsRow(): Promise<NotificationSettingsRow> {
  const db = await getDb();
  const result = await db.query<NotificationSettingsRow>("SELECT TOP 1 * FROM SecurityNotificationSettings ORDER BY Id");
  return result.recordset[0];
}

export interface NotificationSettings {
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursTimezone: string;
  quietHoursAllowCritical: boolean;
  escalationEnabled: boolean;
  digestEnabled: boolean;
  digestHour: number;
  digestChannelId: number | null;
  lastDigestSentAt: string | null;
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const r = await getSettingsRow();
  return {
    quietHoursEnabled: r.QuietHoursEnabled,
    quietHoursStart: r.QuietHoursStart,
    quietHoursEnd: r.QuietHoursEnd,
    quietHoursTimezone: r.QuietHoursTimezone,
    quietHoursAllowCritical: r.QuietHoursAllowCritical,
    escalationEnabled: r.EscalationEnabled,
    digestEnabled: r.DigestEnabled,
    digestHour: r.DigestHour,
    digestChannelId: r.DigestChannelId,
    lastDigestSentAt: r.LastDigestSentAt,
  };
}

export async function updateNotificationSettings(patch: Partial<{
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursTimezone: string;
  quietHoursAllowCritical: boolean;
  escalationEnabled: boolean;
  digestEnabled: boolean;
  digestHour: number;
  digestChannelId: number | null;
}>): Promise<void> {
  const db = await getDb();
  const row = await getSettingsRow();
  const req = db.request().input("id", sql.Int, row.Id);
  const sets: string[] = ["UpdatedAt = SYSUTCDATETIME()"];
  if (patch.quietHoursEnabled !== undefined) {
    sets.push("QuietHoursEnabled = @quietHoursEnabled");
    req.input("quietHoursEnabled", sql.Bit, patch.quietHoursEnabled);
  }
  if (patch.quietHoursStart !== undefined) {
    sets.push("QuietHoursStart = @quietHoursStart");
    req.input("quietHoursStart", sql.VarChar, patch.quietHoursStart);
  }
  if (patch.quietHoursEnd !== undefined) {
    sets.push("QuietHoursEnd = @quietHoursEnd");
    req.input("quietHoursEnd", sql.VarChar, patch.quietHoursEnd);
  }
  if (patch.quietHoursTimezone !== undefined) {
    sets.push("QuietHoursTimezone = @quietHoursTimezone");
    req.input("quietHoursTimezone", sql.VarChar, patch.quietHoursTimezone);
  }
  if (patch.quietHoursAllowCritical !== undefined) {
    sets.push("QuietHoursAllowCritical = @quietHoursAllowCritical");
    req.input("quietHoursAllowCritical", sql.Bit, patch.quietHoursAllowCritical);
  }
  if (patch.escalationEnabled !== undefined) {
    sets.push("EscalationEnabled = @escalationEnabled");
    req.input("escalationEnabled", sql.Bit, patch.escalationEnabled);
  }
  if (patch.digestEnabled !== undefined) {
    sets.push("DigestEnabled = @digestEnabled");
    req.input("digestEnabled", sql.Bit, patch.digestEnabled);
  }
  if (patch.digestHour !== undefined) {
    sets.push("DigestHour = @digestHour");
    req.input("digestHour", sql.Int, patch.digestHour);
  }
  if (patch.digestChannelId !== undefined) {
    sets.push("DigestChannelId = @digestChannelId");
    req.input("digestChannelId", sql.Int, patch.digestChannelId);
  }
  if (sets.length === 1) return;
  await req.query(`UPDATE SecurityNotificationSettings SET ${sets.join(", ")} WHERE Id = @id`);
}

// "Critical" alerts still page through quiet hours by default (QuietHoursAllowCritical) - the
// point of quiet hours is muting routine noise, not muting a real incident.
async function isSuppressedByQuietHours(severity: Severity): Promise<{ suppressed: boolean; reason: string | null }> {
  const settings = await getNotificationSettings();
  if (!settings.quietHoursEnabled || !settings.quietHoursStart || !settings.quietHoursEnd) return { suppressed: false, reason: null };
  if (severity === "critical" && settings.quietHoursAllowCritical) return { suppressed: false, reason: null };
  const within = isWithinQuietHours(new Date(), settings.quietHoursStart, settings.quietHoursEnd, settings.quietHoursTimezone);
  return within
    ? { suppressed: true, reason: `Suppressed by quiet hours (${settings.quietHoursStart}-${settings.quietHoursEnd} ${settings.quietHoursTimezone})` }
    : { suppressed: false, reason: null };
}

// Fans an alert out to every enabled channel whose MinSeverity is at or below the alert's own
// severity - each channel's threshold is independent, so e.g. a webhook can be configured for
// "medium and up" while Slack stays "critical only". Deliberately additive to (not a replacement
// for) alertManager.ts's existing default-recipients email path, which stays untouched.
// During quiet hours a non-critical alert is logged as Suppressed rather than sent - the morning
// digest (sendDigestIfDue below) picks up every Suppressed delivery since the last digest run.
export async function dispatchAlertNotifications(payload: AlertNotificationPayload): Promise<void> {
  const channels = await listChannels();
  const eligible = channels.filter((c) => c.enabled && severityRank(payload.severity) >= severityRank(c.minSeverity));
  if (eligible.length === 0) return;

  const { suppressed, reason } = await isSuppressedByQuietHours(payload.severity);

  const db = await getDb();
  for (const channel of eligible) {
    if (suppressed) {
      await recordDelivery(payload.alertId, channel.id, channel.channelType, { success: false, error: reason }, "Suppressed");
      continue;
    }
    const raw = await db.request().input("id", sql.Int, channel.id).query<ChannelDbRow>("SELECT * FROM SecurityNotificationChannels WHERE Id = @id");
    const config = decryptConfig(raw.recordset[0]?.EncryptedConfig ?? null);
    if (!config) {
      await recordDelivery(payload.alertId, channel.id, channel.channelType, { success: false, error: "Channel has no valid configuration." });
      continue;
    }
    const result = await sendToChannel(channel.channelType, config, payload.subject, payload.body);
    await recordDelivery(payload.alertId, channel.id, channel.channelType, result);
  }
}

export interface EscalationStepRow {
  id: number;
  stepOrder: number;
  delayMinutes: number;
  channelIds: number[];
}

export async function listEscalationSteps(): Promise<EscalationStepRow[]> {
  const db = await getDb();
  const steps = await db.query<{ Id: number; StepOrder: number; DelayMinutes: number }>(
    "SELECT Id, StepOrder, DelayMinutes FROM SecurityAlertEscalationSteps ORDER BY StepOrder ASC"
  );
  const links = await db.query<{ StepId: number; ChannelId: number }>("SELECT StepId, ChannelId FROM SecurityAlertEscalationStepChannels");
  return steps.recordset.map((s) => ({
    id: s.Id,
    stepOrder: s.StepOrder,
    delayMinutes: s.DelayMinutes,
    channelIds: links.recordset.filter((l) => l.StepId === s.Id).map((l) => l.ChannelId),
  }));
}

async function setStepChannels(stepId: number, channelIds: number[]): Promise<void> {
  const db = await getDb();
  await db.request().input("stepId", sql.Int, stepId).query("DELETE FROM SecurityAlertEscalationStepChannels WHERE StepId = @stepId");
  for (const channelId of channelIds) {
    await db
      .request()
      .input("stepId", sql.Int, stepId)
      .input("channelId", sql.Int, channelId)
      .query("INSERT INTO SecurityAlertEscalationStepChannels (StepId, ChannelId) VALUES (@stepId, @channelId)");
  }
}

export async function createEscalationStep(input: { stepOrder: number; delayMinutes: number; channelIds: number[] }): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("stepOrder", sql.Int, input.stepOrder)
    .input("delayMinutes", sql.Int, input.delayMinutes)
    .query<{ Id: number }>("INSERT INTO SecurityAlertEscalationSteps (StepOrder, DelayMinutes) OUTPUT INSERTED.Id VALUES (@stepOrder, @delayMinutes)");
  const id = result.recordset[0].Id;
  await setStepChannels(id, input.channelIds);
  return id;
}

export async function updateEscalationStep(id: number, patch: { stepOrder?: number; delayMinutes?: number; channelIds?: number[] }): Promise<void> {
  const db = await getDb();
  const req = db.request().input("id", sql.Int, id);
  const sets: string[] = [];
  if (patch.stepOrder !== undefined) {
    sets.push("StepOrder = @stepOrder");
    req.input("stepOrder", sql.Int, patch.stepOrder);
  }
  if (patch.delayMinutes !== undefined) {
    sets.push("DelayMinutes = @delayMinutes");
    req.input("delayMinutes", sql.Int, patch.delayMinutes);
  }
  if (sets.length > 0) await req.query(`UPDATE SecurityAlertEscalationSteps SET ${sets.join(", ")} WHERE Id = @id`);
  if (patch.channelIds !== undefined) await setStepChannels(id, patch.channelIds);
}

export async function deleteEscalationStep(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query("DELETE FROM SecurityAlertEscalationSteps WHERE Id = @id");
}

// Scheduled-task entry point (see scripts/run-security-notifications-scheduler.ts) - fires any
// escalation step whose delay has elapsed for a still-open, still-unacknowledged alert, once per
// (alert, step) ever (SecurityAlertEscalations records that). Mirrors
// src/lib/websiteApiMonitoring/escalation.ts's processEscalations() exactly, just against
// SecurityAlerts instead of Incidents and a single global step list instead of per-policy ones.
export async function processSecurityAlertEscalations(): Promise<void> {
  const settings = await getNotificationSettings();
  if (!settings.escalationEnabled) return;

  const db = await getDb();
  const dueAlerts = await db.query<{ Id: number; CreatedAt: string }>(`
    SELECT Id, CONVERT(VARCHAR(33), CreatedAt, 126) AS CreatedAt FROM SecurityAlerts
    WHERE Status NOT IN ('Resolved', 'FalsePositive') AND AcknowledgedAt IS NULL
  `);
  if (dueAlerts.recordset.length === 0) return;

  const steps = await listEscalationSteps();
  if (steps.length === 0) return;

  for (const alert of dueAlerts.recordset) {
    const elapsedMinutes = Math.floor((Date.now() - new Date(alert.CreatedAt).getTime()) / 60000);

    for (const step of steps) {
      if (elapsedMinutes < step.delayMinutes) continue;

      const already = await db
        .request()
        .input("alertId", sql.Int, alert.Id)
        .input("stepId", sql.Int, step.id)
        .query<{ AlertId: number }>("SELECT AlertId FROM SecurityAlertEscalations WHERE AlertId = @alertId AND StepId = @stepId");
      if (already.recordset[0]) continue;

      const subject = `[ESCALATED] Alert #${alert.Id} still unacknowledged`;
      const body = `Alert #${alert.Id} has been open and unacknowledged for ${elapsedMinutes} minute(s). Escalating to the next contact(s).`;

      for (const channelId of step.channelIds) {
        const raw = await db.request().input("id", sql.Int, channelId).query<ChannelDbRow>("SELECT * FROM SecurityNotificationChannels WHERE Id = @id");
        const channel = raw.recordset[0];
        if (!channel || !channel.Enabled) continue;
        const config = decryptConfig(channel.EncryptedConfig);
        if (!config) {
          await recordDelivery(alert.Id, channelId, channel.ChannelType as ChannelType, { success: false, error: "Channel has no valid configuration." });
          continue;
        }
        const result = await sendToChannel(channel.ChannelType as ChannelType, config, subject, body);
        await recordDelivery(alert.Id, channelId, channel.ChannelType as ChannelType, result);
      }

      // Recorded even when the step had zero channels configured - the step "fired", it just had
      // nothing to notify; re-evaluating it every pass forever would be the actual bug.
      await db.request().input("alertId", sql.Int, alert.Id).input("stepId", sql.Int, step.id).query("INSERT INTO SecurityAlertEscalations (AlertId, StepId) VALUES (@alertId, @stepId)");
    }
  }
}

// Scheduled-task entry point - batches every quiet-hours-suppressed delivery since the last
// digest into one summary message, sent through the configured DigestChannelId. Fires once per
// day: the first scheduler pass at or after DigestHour (in the settings' own timezone) sends it;
// LastDigestSentAt then blocks every other pass that same day.
export async function sendDigestIfDue(): Promise<void> {
  const settings = await getNotificationSettings();
  if (!settings.digestEnabled || !settings.digestChannelId) return;

  const tz = settings.quietHoursTimezone;
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const currentHour = Number(get("hour"));
  const todayKey = `${get("year")}-${get("month")}-${get("day")}`;
  if (currentHour < settings.digestHour) return;

  if (settings.lastDigestSentAt) {
    const lastParts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(settings.lastDigestSentAt));
    const lastKey = `${lastParts.find((p) => p.type === "year")?.value}-${lastParts.find((p) => p.type === "month")?.value}-${lastParts.find((p) => p.type === "day")?.value}`;
    if (lastKey === todayKey) return; // already sent today
  }

  const db = await getDb();
  const since = settings.lastDigestSentAt ? new Date(settings.lastDigestSentAt) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const suppressed = await db.request().input("since", sql.DateTime2, since).query<{
    AlertId: number;
    Severity: string;
    Category: string;
    Status: string;
  }>(`
    SELECT DISTINCT d.AlertId, a.Severity, a.Category, a.Status
    FROM SecurityNotificationDeliveries d
    JOIN SecurityAlerts a ON a.Id = d.AlertId
    WHERE d.Status = 'Suppressed' AND d.SentAt >= @since
  `);

  const channel = await db.request().input("id", sql.Int, settings.digestChannelId).query<ChannelDbRow>("SELECT * FROM SecurityNotificationChannels WHERE Id = @id");
  const channelRow = channel.recordset[0];
  if (!channelRow) return;
  const config = decryptConfig(channelRow.EncryptedConfig);

  const rows = suppressed.recordset;
  const bySeverity = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.Severity] = (acc[r.Severity] ?? 0) + 1;
    return acc;
  }, {});
  const subject = `Security alerts digest - ${rows.length} held back during quiet hours`;
  const body =
    rows.length === 0
      ? "No alerts were held back during quiet hours since the last digest."
      : [
          `${rows.length} alert(s) were suppressed during quiet hours since the last digest:`,
          Object.entries(bySeverity)
            .map(([sev, n]) => `${sev}: ${n}`)
            .join(", "),
          "",
          ...rows.slice(0, 50).map((r) => `#${r.AlertId} - ${r.Severity} - ${r.Category} - ${r.Status}`),
          rows.length > 50 ? `...and ${rows.length - 50} more.` : "",
        ]
          .filter(Boolean)
          .join("\n");

  if (config) {
    const result = await sendToChannel(channelRow.ChannelType as ChannelType, config, subject, body);
    await recordDelivery(null, channelRow.Id, channelRow.ChannelType as ChannelType, result);
  }

  await db.request().query("UPDATE SecurityNotificationSettings SET LastDigestSentAt = SYSUTCDATETIME()");
}

// Sends a synthetic alert-shaped message through one specific channel right now, regardless of
// its MinSeverity/Enabled state - lets an admin verify a webhook URL/Slack channel/username is
// correctly configured before relying on it for real alerts.
export async function testChannel(id: number): Promise<ChannelSendResult> {
  const db = await getDb();
  const raw = await db.request().input("id", sql.Int, id).query<ChannelDbRow>("SELECT * FROM SecurityNotificationChannels WHERE Id = @id");
  const row = raw.recordset[0];
  if (!row) return { success: false, error: "Channel not found." };
  const config = decryptConfig(row.EncryptedConfig);
  if (!config) return { success: false, error: "Channel has no valid configuration." };
  return sendToChannel(row.ChannelType as ChannelType, config, "Intrusion Detection - Test Notification", "This is a test notification from the Intrusion Detection module's Notifications settings. If you received this, the channel is configured correctly.");
}
