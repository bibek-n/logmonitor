import crypto from "crypto";
import { getDb, sql } from "../db";
import { WebhookContactConfig } from "./types";

export interface ChannelSendResult {
  success: boolean;
  error: string | null;
}

const SEND_TIMEOUT_MS = 8000;

// Slack/Teams/Webhook destinations are admin-configured integration endpoints (entered once,
// by a trusted admin, in Alert Contacts) rather than arbitrary monitor targets a user requests
// checks against - unlike website/API monitor URLs, these don't go through the SSRF guard.
// Plain global fetch() is used here rather than the hand-rolled http/https client the checkers
// use, since there's no need for per-phase timing or a custom DNS lookup hook for this call.
async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<ChannelSendResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, error: `HTTP ${res.status}${text ? `: ${text.slice(0, 300)}` : ""}` };
    }
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Request failed." };
  }
}

// Slack's classic incoming-webhook format - a single "text" field, markdown-lite (*bold*).
export async function sendSlackAlert(webhookUrl: string, subject: string, body: string): Promise<ChannelSendResult> {
  return postJson(webhookUrl, {}, { text: `*${subject}*\n${body}` });
}

// Microsoft Teams' classic O365 connector webhook format - also accepts a plain "text" field.
export async function sendTeamsAlert(webhookUrl: string, subject: string, body: string): Promise<ChannelSendResult> {
  return postJson(webhookUrl, {}, { "@type": "MessageCard", "@context": "http://schema.org/extensions", summary: subject, text: `**${subject}**\n\n${body}` });
}

// Generic webhook: posts the raw event as JSON, optionally HMAC-SHA256-signed (hex digest of
// the JSON body, header X-Signature) so the receiving end can verify it actually came from
// this app - the same purpose signingSecret serves for every other webhook-consuming platform.
export async function sendWebhookAlert(
  webhookUrl: string,
  config: WebhookContactConfig | null,
  payload: { eventType: string; subject: string; body: string; monitorId: number; incidentId: number | null }
): Promise<ChannelSendResult> {
  const headers: Record<string, string> = {};
  if (config?.signingSecret) {
    const signature = crypto.createHmac("sha256", config.signingSecret).update(JSON.stringify(payload)).digest("hex");
    headers["X-Signature"] = signature;
  }
  return postJson(webhookUrl, headers, payload);
}

// In-app: no outbound HTTP at all - Destination is a Users.Username, resolved to an Id and
// inserted as one row in InAppNotifications for that user to see in their notification feed.
export async function sendInAppAlert(
  username: string,
  payload: { eventType: string; subject: string; body: string; monitorId: number | null; incidentId: number | null }
): Promise<ChannelSendResult> {
  const db = await getDb();
  const user = await db.request().input("username", sql.NVarChar, username).query<{ Id: number }>("SELECT Id FROM Users WHERE Username = @username");
  const userId = user.recordset[0]?.Id;
  if (!userId) return { success: false, error: `No user found with username "${username}".` };

  await db
    .request()
    .input("userId", sql.Int, userId)
    .input("eventType", sql.VarChar, payload.eventType)
    .input("subject", sql.NVarChar, payload.subject)
    .input("body", sql.NVarChar, payload.body)
    .input("monitorId", sql.Int, payload.monitorId)
    .input("incidentId", sql.Int, payload.incidentId)
    .query(`
      INSERT INTO InAppNotifications (UserId, EventType, Subject, Body, MonitorId, IncidentId)
      VALUES (@userId, @eventType, @subject, @body, @monitorId, @incidentId)
    `);

  return { success: true, error: null };
}
