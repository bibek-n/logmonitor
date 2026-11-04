import { getDb, sql } from "./db";
import type { SendResult } from "./notifyEmail";

interface WebhookConfig {
  url: string;
  platform: string;
}

async function resolveWebhookConfig(): Promise<WebhookConfig | null> {
  try {
    const db = await getDb();
    const result = await db.query<{ Url: string | null; Platform: string | null; Enabled: boolean }>`
      SELECT Url, Platform, Enabled FROM WebhookSettings WHERE Id = 1
    `;
    const row = result.recordset[0];
    if (!row?.Enabled || !row.Url) return null;
    return { url: row.Url, platform: row.Platform ?? "slack" };
  } catch {
    // WebhookSettings table may not exist yet on older deployments.
    return null;
  }
}

async function logWebhookDelivery(url: string, subject: string, success: boolean, errorMessage?: string): Promise<void> {
  try {
    const db = await getDb();
    await db
      .request()
      .input("toAddress", sql.NVarChar, url)
      .input("subject", sql.NVarChar, subject)
      .input("success", sql.Bit, success)
      .input("errorMessage", sql.NVarChar, errorMessage ?? null)
      .query("INSERT INTO EmailDeliveryLog (ToAddress, Subject, Success, ErrorMessage) VALUES (@toAddress, @subject, @success, @errorMessage)");
  } catch (err) {
    console.error("[notifyWebhook] failed to write delivery log row:", err instanceof Error ? err.message : err);
  }
}

// Slack and Microsoft Teams incoming webhooks both accept this same minimal
// `{"text": "..."}` JSON payload - no need for separate Block Kit / Adaptive Card builders
// for a plain-text alert echo. "generic" just posts the same shape for any other receiver
// that accepts a JSON body with a text field (most alerting tools do).
function buildPayload(subject: string, body: string): string {
  return JSON.stringify({ text: `*${subject}*\n${body}` });
}

// Best-effort, non-throwing mirror of sendNotificationEmail - never blocks or fails the
// caller's email send. One global channel (Settings > Notifications > Webhook Alerts),
// not per-module like the email recipients table, since this is a delivery channel, not a
// routing decision.
export async function sendWebhookNotification(subject: string, body: string): Promise<SendResult> {
  const config = await resolveWebhookConfig();
  if (!config) return { success: false, error: "Webhook not configured or disabled" };

  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: buildPayload(subject, body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Webhook endpoint returned ${res.status}: ${text.slice(0, 300)}`);
    }
    await logWebhookDelivery(config.url, `[webhook] ${subject}`, true);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[notifyWebhook] failed to post:", message);
    await logWebhookDelivery(config.url, `[webhook] ${subject}`, false, message);
    return { success: false, error: message };
  }
}
