import { getDb } from "@/lib/db";

// Snooze reuses the SecurityAlerts.SuppressedUntil column that already existed (unused)
// alongside the "Suppressed" status - no new schema. There's no background job to wake a
// snoozed alert back up; instead, every read path that decides what counts as "open" calls
// this first, which lazily flips any alert whose snooze window has passed back to New and
// records the transition in SecurityAlertStatusHistory, same as a manual status change would.
// Cheap no-op when nothing has expired (the common case).
export async function reactivateExpiredSnoozes(): Promise<void> {
  const db = await getDb();

  const expired = await db.query<{ Id: number }>(`
    SELECT Id FROM SecurityAlerts WHERE Status = 'Suppressed' AND SuppressedUntil IS NOT NULL AND SuppressedUntil <= SYSUTCDATETIME()
  `);
  if (expired.recordset.length === 0) return;

  const ids = expired.recordset.map((r) => r.Id).filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return;
  const idList = ids.join(",");

  await db.query(`
    UPDATE SecurityAlerts SET Status = 'New', SuppressedUntil = NULL, UpdatedAt = SYSUTCDATETIME()
    WHERE Id IN (${idList}) AND Status = 'Suppressed' AND SuppressedUntil IS NOT NULL AND SuppressedUntil <= SYSUTCDATETIME()
  `);

  await db.query(`
    INSERT INTO SecurityAlertStatusHistory (AlertId, OldStatus, NewStatus, ChangedByUserId, ChangedByUsername, Reason)
    SELECT v.Id, 'Suppressed', 'New', NULL, NULL, 'Snooze expired' FROM (VALUES ${ids.map((id) => `(${id})`).join(",")}) AS v(Id)
  `);
}
