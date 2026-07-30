import { getDb, sql } from "../db";
import { sendNotificationEmail } from "../notifyEmail";
import { sendSlackAlert, sendTeamsAlert, sendWebhookAlert, sendInAppAlert } from "./alertChannels";
import { isWithinQuietHours } from "./quietHours";
import { AlertContactType, WebhookContactConfig } from "./types";

export type MonitoringEventType =
  | "WebsiteDown"
  | "WebsiteRecovered"
  | "WebsiteDegraded"
  | "SslExpiring"
  | "SslExpired"
  | "ApiDown"
  | "ApiRecovered"
  | "ApiDegraded"
  | "SlaBreach";

// "Critical" events still page through quiet hours (when a policy's QuietHoursAllowCritical is
// set, the default) - the point of quiet hours is muting routine noise (recovery/degraded/SSL
// reminders), not muting a real outage.
const CRITICAL_EVENT_TYPES: MonitoringEventType[] = ["WebsiteDown", "ApiDown"];

export interface AlertContactRow {
  Id: number | null;
  ContactType: AlertContactType;
  Destination: string;
  ConfigJson: string | null;
}

interface AlertPolicyRow {
  Id: number;
  QuietHoursEnabled: boolean;
  QuietHoursStart: string | null;
  QuietHoursEnd: string | null;
  QuietHoursTimezone: string;
  QuietHoursAllowCritical: boolean;
}

async function resolveAlertPolicy(alertPolicyId: number | null): Promise<AlertPolicyRow | null> {
  const db = await getDb();
  const result = alertPolicyId
    ? await db
        .request()
        .input("id", sql.Int, alertPolicyId)
        .query<AlertPolicyRow>(
          "SELECT Id, QuietHoursEnabled, QuietHoursStart, QuietHoursEnd, QuietHoursTimezone, QuietHoursAllowCritical FROM AlertPolicies WHERE Id = @id"
        )
    : await db.query<AlertPolicyRow>(
        "SELECT TOP 1 Id, QuietHoursEnabled, QuietHoursStart, QuietHoursEnd, QuietHoursTimezone, QuietHoursAllowCritical FROM AlertPolicies WHERE IsDefault = 1"
      );
  return result.recordset[0] ?? null;
}

// Resolves every active contact attached to a monitor's alert policy (falling back to the
// singleton default policy) across all channel types - not Email-only, as Phase 1/2 were.
async function resolvePolicyContacts(alertPolicyId: number | null): Promise<AlertContactRow[]> {
  const db = await getDb();
  const policyId =
    alertPolicyId ??
    (await db.query<{ Id: number }>("SELECT TOP 1 Id FROM AlertPolicies WHERE IsDefault = 1")).recordset[0]?.Id ??
    null;
  if (policyId === null) return [];

  const result = await db
    .request()
    .input("policyId", sql.Int, policyId)
    .query<AlertContactRow>(`
      SELECT ac.Id, ac.ContactType, ac.Destination, ac.ConfigJson
      FROM AlertPolicyContacts apc
      JOIN AlertContacts ac ON ac.Id = apc.AlertContactId
      WHERE apc.AlertPolicyId = @policyId AND ac.IsActive = 1
    `);
  return result.recordset;
}

// Merges the alert policy's contacts (any channel) with the monitor's own AlertEmail
// override/addition (still Email-only, same comma-separated convention as before). Ad-hoc
// addresses that aren't a saved AlertContact get AlertContactId = NULL in NotificationLogs -
// deduped case-insensitively against the policy's own Email contacts.
export async function resolveAlertContacts(alertPolicyId: number | null, monitorAlertEmail: string | null): Promise<AlertContactRow[]> {
  const policyContacts = await resolvePolicyContacts(alertPolicyId);
  const seen = new Set(policyContacts.filter((c) => c.ContactType === "Email").map((c) => c.Destination.toLowerCase()));

  const extra = (monitorAlertEmail ?? "")
    .split(",")
    .map((addr) => addr.trim())
    .filter(Boolean)
    .filter((addr) => {
      const key = addr.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((addr) => ({ Id: null, ContactType: "Email" as const, Destination: addr, ConfigJson: null }));

  return [...policyContacts, ...extra];
}

interface DispatchPayload {
  // Loosened to plain string (not just MonitoringEventType) so a one-off "Test" send from the
  // Alert Contacts UI can reuse this same dispatch path instead of a parallel implementation.
  eventType: string;
  monitorId: number;
  incidentId: number | null;
  subject: string;
  body: string;
}

// The one place that actually sends to a single contact, regardless of channel - shared by
// sendMonitoringAlert() below and the escalation engine (escalation.ts), so a step-2 escalation
// contact goes through the exact same per-channel logic as an immediate notification.
export async function dispatchToContact(contact: AlertContactRow, payload: DispatchPayload): Promise<{ success: boolean; error: string | null }> {
  switch (contact.ContactType) {
    case "Email": {
      const result = await sendNotificationEmail({ to: contact.Destination, subject: payload.subject, body: payload.body });
      return { success: result.success, error: result.error ?? null };
    }
    case "Slack":
      return sendSlackAlert(contact.Destination, payload.subject, payload.body);
    case "Teams":
      return sendTeamsAlert(contact.Destination, payload.subject, payload.body);
    case "Webhook": {
      const config: WebhookContactConfig | null = contact.ConfigJson ? JSON.parse(contact.ConfigJson) : null;
      return sendWebhookAlert(contact.Destination, config, {
        eventType: payload.eventType,
        subject: payload.subject,
        body: payload.body,
        monitorId: payload.monitorId,
        incidentId: payload.incidentId,
      });
    }
    case "InApp":
      return sendInAppAlert(contact.Destination, {
        eventType: payload.eventType,
        subject: payload.subject,
        body: payload.body,
        monitorId: payload.monitorId,
        incidentId: payload.incidentId,
      });
  }
}

export async function logNotificationAttempt(params: {
  eventType: MonitoringEventType | string;
  monitorId: number | null;
  incidentId: number | null;
  contactId: number | null;
  provider: AlertContactType;
  subject: string;
  body: string;
  status: "Sent" | "Failed" | "Suppressed";
  failureReason: string | null;
}): Promise<void> {
  const db = await getDb();
  // A "Failed" send becomes eligible for a first retry attempt 2 minutes out - the retry pass
  // itself (notificationRetry.ts) applies its own backoff on subsequent attempts.
  const nextRetryAt = params.status === "Failed" ? new Date(Date.now() + 2 * 60 * 1000) : null;
  await db
    .request()
    .input("eventType", sql.VarChar, params.eventType)
    .input("monitorId", sql.Int, params.monitorId)
    .input("incidentId", sql.Int, params.incidentId)
    .input("contactId", sql.Int, params.contactId)
    .input("subject", sql.NVarChar, params.subject)
    .input("body", sql.NVarChar(sql.MAX), params.body)
    .input("provider", sql.VarChar, params.provider)
    .input("status", sql.VarChar, params.status)
    .input("sentAt", sql.DateTime2, params.status === "Sent" ? new Date() : null)
    .input("failureReason", sql.NVarChar, params.failureReason)
    .input("nextRetryAt", sql.DateTime2, nextRetryAt)
    .query(`
      INSERT INTO NotificationLogs (EventType, MonitorId, IncidentId, AlertContactId, Subject, Body, Provider, Status, SentAt, FailureReason, NextRetryAt)
      VALUES (@eventType, @monitorId, @incidentId, @contactId, @subject, @body, @provider, @status, @sentAt, @failureReason, @nextRetryAt)
    `);
}

interface SendEventParams {
  eventType: MonitoringEventType;
  alertPolicyId: number | null;
  monitorAlertEmail?: string | null;
  monitorId: number;
  incidentId: number | null;
  subject: string;
  body: string;
}

// Sends one notification per active contact on the resolved policy (any channel) plus the
// monitor's own AlertEmail (if set), and writes one NotificationLogs row per attempt - never
// throws, a notification failure must not break the scheduled check that triggered it. Skips
// (logs as "Suppressed", does not send) non-critical events during the policy's configured
// quiet-hours window.
export async function sendMonitoringAlert(params: SendEventParams): Promise<void> {
  const policy = await resolveAlertPolicy(params.alertPolicyId);

  if (policy?.QuietHoursEnabled && policy.QuietHoursStart && policy.QuietHoursEnd) {
    const isCritical = CRITICAL_EVENT_TYPES.includes(params.eventType);
    const suppressed = !(isCritical && policy.QuietHoursAllowCritical) && isWithinQuietHours(new Date(), policy.QuietHoursStart, policy.QuietHoursEnd, policy.QuietHoursTimezone);
    if (suppressed) {
      await logNotificationAttempt({
        eventType: params.eventType,
        monitorId: params.monitorId,
        incidentId: params.incidentId,
        contactId: null,
        provider: "Email",
        subject: params.subject,
        body: params.body,
        status: "Suppressed",
        failureReason: `Suppressed by quiet hours (${policy.QuietHoursStart}-${policy.QuietHoursEnd} ${policy.QuietHoursTimezone}).`,
      });
      return;
    }
  }

  const contacts = await resolveAlertContacts(params.alertPolicyId, params.monitorAlertEmail ?? null);

  if (contacts.length === 0) {
    await logNotificationAttempt({
      eventType: params.eventType,
      monitorId: params.monitorId,
      incidentId: params.incidentId,
      contactId: null,
      provider: "Email",
      subject: params.subject,
      body: params.body,
      status: "Failed",
      failureReason: "No active contacts on the resolved alert policy and no AlertEmail set on the monitor.",
    });
    return;
  }

  for (const contact of contacts) {
    const result = await dispatchToContact(contact, { eventType: params.eventType, monitorId: params.monitorId, incidentId: params.incidentId, subject: params.subject, body: params.body });
    await logNotificationAttempt({
      eventType: params.eventType,
      monitorId: params.monitorId,
      incidentId: params.incidentId,
      contactId: contact.Id,
      provider: contact.ContactType,
      subject: params.subject,
      body: params.body,
      status: result.success ? "Sent" : "Failed",
      failureReason: result.error,
    });
  }
}

export function buildAlertMessage(eventType: MonitoringEventType, monitorName: string, url: string, reason: string | null): { subject: string; body: string } {
  switch (eventType) {
    case "WebsiteDown":
      return {
        subject: `[DOWN] ${monitorName}`,
        body: `${monitorName} (${url}) is down.\n\nReason: ${reason ?? "Unknown"}\n\nWe'll notify you again once it recovers.`,
      };
    case "WebsiteRecovered":
      return { subject: `[RECOVERED] ${monitorName}`, body: `${monitorName} (${url}) has recovered and is back up.` };
    case "WebsiteDegraded":
      return {
        subject: `[DEGRADED] ${monitorName}`,
        body: `${monitorName} (${url}) is responding slower than its configured warning threshold.\n\n${reason ?? ""}`,
      };
    case "SslExpiring":
      return { subject: `[SSL EXPIRING] ${monitorName}`, body: `The SSL certificate for ${monitorName} (${url}) is expiring soon.\n\n${reason ?? ""}` };
    case "SslExpired":
      return { subject: `[SSL EXPIRED] ${monitorName}`, body: `The SSL certificate for ${monitorName} (${url}) has expired.\n\n${reason ?? ""}` };
    case "ApiDown":
      return {
        subject: `[DOWN] ${monitorName}`,
        body: `${monitorName} (${url}) is down.\n\nReason: ${reason ?? "Unknown"}\n\nWe'll notify you again once it recovers.`,
      };
    case "ApiRecovered":
      return { subject: `[RECOVERED] ${monitorName}`, body: `${monitorName} (${url}) has recovered and is back up.` };
    case "ApiDegraded":
      return {
        subject: `[DEGRADED] ${monitorName}`,
        body: `${monitorName} (${url}) is responding slower than its configured warning threshold.\n\n${reason ?? ""}`,
      };
    case "SlaBreach":
      return {
        subject: `[SLA BREACH] ${monitorName}`,
        body: `${monitorName} (${url}) has fallen below its configured SLA target.\n\n${reason ?? ""}`,
      };
  }
}
