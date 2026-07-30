import { getDb, sql } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/notifyEmail";
import { sendSlackAlert, sendTeamsAlert, sendWebhookAlert, sendInAppAlert, type ChannelSendResult } from "@/lib/websiteApiMonitoring/alertChannels";
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

async function recordDelivery(alertId: number | null, channelId: number | null, channelType: ChannelType, result: ChannelSendResult): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("alertId", sql.Int, alertId)
    .input("channelId", sql.Int, channelId)
    .input("channelType", sql.VarChar, channelType)
    .input("status", sql.VarChar, result.success ? "Sent" : "Failed")
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

// Fans an alert out to every enabled channel whose MinSeverity is at or below the alert's own
// severity - each channel's threshold is independent, so e.g. a webhook can be configured for
// "medium and up" while Slack stays "critical only". Deliberately additive to (not a replacement
// for) alertManager.ts's existing default-recipients email path, which stays untouched.
export async function dispatchAlertNotifications(payload: AlertNotificationPayload): Promise<void> {
  const channels = await listChannels();
  const eligible = channels.filter((c) => c.enabled && severityRank(payload.severity) >= severityRank(c.minSeverity));
  if (eligible.length === 0) return;

  const db = await getDb();
  for (const channel of eligible) {
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
