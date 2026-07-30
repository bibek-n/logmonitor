import { getDb, sql } from "../db";
import { IncidentSeverity } from "./types";

interface OpenIncidentParams {
  monitorId: number;
  monitorName: string;
  failureReason: string | null;
  httpStatusCode: number | null;
  severity?: IncidentSeverity;
}

// Enforces "no duplicate open incidents for the same monitor" (spec section 15) by checking
// for an existing Status='Open' row before inserting a new one - if the scheduled script
// somehow runs evaluateCheckResult() twice for the same down monitor before the first
// incident write commits, this is the guard against a second row being created.
export async function openIncidentIfNeeded(params: OpenIncidentParams): Promise<number | null> {
  const db = await getDb();
  const existing = await db
    .request()
    .input("monitorId", sql.Int, params.monitorId)
    .query<{ Id: number }>("SELECT Id FROM Incidents WHERE MonitorId = @monitorId AND Status = 'Open'");
  if (existing.recordset[0]) return existing.recordset[0].Id;

  const inserted = await db
    .request()
    .input("monitorId", sql.Int, params.monitorId)
    .input("title", sql.NVarChar, `${params.monitorName} is down`)
    .input("severity", sql.VarChar, params.severity ?? "High")
    .input("failureReason", sql.NVarChar, params.failureReason)
    .input("httpStatusCode", sql.Int, params.httpStatusCode)
    .query<{ Id: number }>(`
      INSERT INTO Incidents (MonitorId, Title, Severity, Status, FailureReason, HttpStatusCode)
      OUTPUT INSERTED.Id
      VALUES (@monitorId, @title, @severity, 'Open', @failureReason, @httpStatusCode)
    `);
  return inserted.recordset[0].Id;
}

export async function resolveIncidentIfOpen(monitorId: number): Promise<number | null> {
  const db = await getDb();
  const existing = await db
    .request()
    .input("monitorId", sql.Int, monitorId)
    .query<{ Id: number; StartedAt: string }>(
      "SELECT Id, CONVERT(VARCHAR(33), StartedAt, 126) AS StartedAt FROM Incidents WHERE MonitorId = @monitorId AND Status = 'Open'"
    );
  const incident = existing.recordset[0];
  if (!incident) return null;

  const downtimeSeconds = Math.max(0, Math.round((Date.now() - new Date(incident.StartedAt).getTime()) / 1000));

  await db
    .request()
    .input("id", sql.Int, incident.Id)
    .input("downtimeSeconds", sql.Int, downtimeSeconds)
    .query("UPDATE Incidents SET Status = 'Resolved', ResolvedAt = SYSUTCDATETIME(), DowntimeSeconds = @downtimeSeconds WHERE Id = @id");

  return incident.Id;
}

// --- Phase 3: interactive incident workflow ---
// These are the manual counterparts to the two automatic transitions above - a human
// acknowledging/assigning/annotating/reclassifying/resolving/reopening an incident, as opposed
// to the scheduled scan's own auto-open-on-failure / auto-resolve-on-recovery. Acknowledging
// also stops the escalation engine (escalation.ts) from firing any further steps for this
// incident - it only ever considers incidents where AcknowledgedAt IS NULL.

export async function acknowledgeIncident(incidentId: number, userId: number): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, incidentId)
    .input("userId", sql.Int, userId)
    .query("UPDATE Incidents SET AcknowledgedAt = SYSUTCDATETIME(), AcknowledgedByUserId = @userId WHERE Id = @id AND AcknowledgedAt IS NULL");
}

export async function assignIncident(incidentId: number, userId: number | null): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, incidentId).input("userId", sql.Int, userId).query("UPDATE Incidents SET AssignedToUserId = @userId WHERE Id = @id");
}

export async function addIncidentNote(incidentId: number, userId: number, note: string): Promise<number> {
  const db = await getDb();
  const inserted = await db
    .request()
    .input("incidentId", sql.Int, incidentId)
    .input("userId", sql.Int, userId)
    .input("note", sql.NVarChar, note)
    .query<{ Id: number }>("INSERT INTO IncidentNotes (IncidentId, UserId, Note) OUTPUT INSERTED.Id VALUES (@incidentId, @userId, @note)");
  return inserted.recordset[0].Id;
}

export async function changeIncidentSeverity(incidentId: number, severity: IncidentSeverity): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, incidentId).input("severity", sql.VarChar, severity).query("UPDATE Incidents SET Severity = @severity WHERE Id = @id");
}

// Manual resolve: unlike resolveIncidentIfOpen() (called automatically when a check recovers),
// this can be invoked on an incident whose monitor hasn't actually recovered yet (e.g. a known
// false positive, or the team fixed it out-of-band and the next check just hasn't run yet). If
// the monitor genuinely is still failing, the very next scheduled check will simply reopen a
// new incident via openIncidentIfNeeded() - this doesn't suppress future detection.
export async function manualResolveIncident(incidentId: number, userId: number, note: string | null): Promise<void> {
  const db = await getDb();
  const existing = await db
    .request()
    .input("id", sql.Int, incidentId)
    .query<{ StartedAt: string }>("SELECT CONVERT(VARCHAR(33), StartedAt, 126) AS StartedAt FROM Incidents WHERE Id = @id");
  const row = existing.recordset[0];
  if (!row) return;

  const downtimeSeconds = Math.max(0, Math.round((Date.now() - new Date(row.StartedAt).getTime()) / 1000));

  await db
    .request()
    .input("id", sql.Int, incidentId)
    .input("downtimeSeconds", sql.Int, downtimeSeconds)
    .query("UPDATE Incidents SET Status = 'Resolved', ResolvedAt = SYSUTCDATETIME(), DowntimeSeconds = @downtimeSeconds WHERE Id = @id");

  if (note) await addIncidentNote(incidentId, userId, `Manually resolved: ${note}`);
}

// Reopen: for a Resolved incident that turns out not to have actually been fixed. Clears
// ResolvedAt/DowntimeSeconds and acknowledgement (a reopened incident needs fresh
// acknowledgement, and becomes eligible for escalation again) - deliberately does NOT touch
// StartedAt, so downtime reporting reflects the original failure onset if it's resolved again.
export async function reopenIncident(incidentId: number, userId: number, note: string | null): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, incidentId)
    .query("UPDATE Incidents SET Status = 'Open', ResolvedAt = NULL, DowntimeSeconds = NULL, AcknowledgedAt = NULL, AcknowledgedByUserId = NULL WHERE Id = @id");

  if (note) await addIncidentNote(incidentId, userId, `Reopened: ${note}`);
}
