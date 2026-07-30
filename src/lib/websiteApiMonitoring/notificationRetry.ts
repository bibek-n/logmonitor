import { getDb, sql } from "../db";
import { dispatchToContact, AlertContactRow } from "./notifications";

const MAX_RETRY_ATTEMPTS = 5;
// Minutes to wait before the Nth retry attempt (index 0 = wait before attempt #1, already set
// by logNotificationAttempt's initial 2-minute NextRetryAt) - backs off further each time
// rather than hammering a still-down endpoint every pass.
const RETRY_BACKOFF_MINUTES = [2, 5, 15, 30, 60];

interface RetryableRow {
  Id: number;
  EventType: string;
  MonitorId: number | null;
  IncidentId: number | null;
  Subject: string;
  Body: string;
  RetryCount: number;
  ContactId: number;
  ContactType: AlertContactRow["ContactType"];
  Destination: string;
  ConfigJson: string | null;
}

async function retryRow(row: RetryableRow): Promise<{ success: boolean; error: string | null }> {
  const db = await getDb();
  const contact: AlertContactRow = { Id: row.ContactId, ContactType: row.ContactType, Destination: row.Destination, ConfigJson: row.ConfigJson };
  const result = await dispatchToContact(contact, { eventType: row.EventType, monitorId: row.MonitorId ?? 0, incidentId: row.IncidentId, subject: row.Subject, body: row.Body });

  const newRetryCount = row.RetryCount + 1;
  const nextRetryAt = result.success || newRetryCount >= MAX_RETRY_ATTEMPTS ? null : new Date(Date.now() + (RETRY_BACKOFF_MINUTES[newRetryCount] ?? 60) * 60 * 1000);

  await db
    .request()
    .input("id", sql.Int, row.Id)
    .input("status", sql.VarChar, result.success ? "Sent" : "Failed")
    .input("sentAt", sql.DateTime2, result.success ? new Date() : null)
    .input("failureReason", sql.NVarChar, result.error)
    .input("retryCount", sql.Int, newRetryCount)
    .input("nextRetryAt", sql.DateTime2, nextRetryAt)
    .query("UPDATE NotificationLogs SET Status=@status, SentAt=@sentAt, FailureReason=@failureReason, RetryCount=@retryCount, NextRetryAt=@nextRetryAt WHERE Id=@id");

  return { success: result.success, error: result.error };
}

const RETRYABLE_ROW_SELECT = `
  SELECT n.Id, n.EventType, n.MonitorId, n.IncidentId, n.Subject, n.Body, n.RetryCount,
    ac.Id AS ContactId, ac.ContactType, ac.Destination, ac.ConfigJson
  FROM NotificationLogs n
  JOIN AlertContacts ac ON ac.Id = n.AlertContactId
`;
// The JOIN to AlertContacts means an ad-hoc AlertEmail address (AlertContactId IS NULL - not
// a saved contact) never qualifies for retry, automatic or manual - there's no contact row to
// re-dispatch through. Only failures against a real, saved Alert Contact are retryable.

// Scheduled-scan retry pass: every Failed, retryable row whose NextRetryAt has come due.
export async function processNotificationRetries(): Promise<void> {
  const db = await getDb();
  const due = await db.query<RetryableRow>(`
    ${RETRYABLE_ROW_SELECT}
    WHERE n.Status = 'Failed' AND n.Body IS NOT NULL AND n.RetryCount < ${MAX_RETRY_ATTEMPTS}
      AND n.NextRetryAt IS NOT NULL AND n.NextRetryAt <= SYSUTCDATETIME()
  `);

  for (const row of due.recordset) {
    await retryRow(row);
  }
}

// Manual "Retry Now" from the Notification Logs page - ignores NextRetryAt/RetryCount caps
// (an admin explicitly asking for it now overrides the automatic backoff schedule).
export async function retryNotificationNow(notificationLogId: number): Promise<{ success: boolean; error: string | null } | null> {
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, notificationLogId).query<RetryableRow>(`${RETRYABLE_ROW_SELECT} WHERE n.Id = @id`);
  const row = result.recordset[0];
  if (!row || !row.Body) return null;
  return retryRow(row);
}
