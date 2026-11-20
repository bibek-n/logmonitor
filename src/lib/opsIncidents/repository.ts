import { getDb, sql } from "../db";

export const INCIDENT_SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

// Mirrors the existing website-monitoring Incidents table's own Status enum, for consistency
// across the app's two separate incident concepts (see migrate-ops-incidents.ts's header
// comment for why this is a new table rather than extending that one).
export const INCIDENT_STATUSES = ["Open", "Investigating", "Identified", "Monitoring", "Resolved", "Closed"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

interface Actor {
  userId: number;
  username: string;
}

async function addTimelineEntry(incidentId: number, entryType: string, message: string, actor: Actor | null): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("incidentId", sql.Int, incidentId)
    .input("entryType", sql.VarChar, entryType)
    .input("message", sql.NVarChar, message)
    .input("userId", sql.Int, actor?.userId ?? null)
    .input("username", sql.NVarChar, actor?.username ?? null)
    .query("INSERT INTO OpsIncidentTimeline (IncidentId, EntryType, Message, UserId, Username) VALUES (@incidentId, @entryType, @message, @userId, @username)");
}

export interface IncidentListRow {
  id: number;
  title: string;
  severity: IncidentSeverity;
  affectedSystem: string | null;
  status: IncidentStatus;
  ownerUsername: string | null;
  startedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  linkedAlertCount: number;
}

export async function listIncidents(filters: { status?: string; severity?: string; ownerUserId?: number }): Promise<IncidentListRow[]> {
  const db = await getDb();
  const clauses: string[] = [];
  const req = db.request();
  if (filters.status) {
    clauses.push("i.Status = @status");
    req.input("status", sql.VarChar, filters.status);
  }
  if (filters.severity) {
    clauses.push("i.Severity = @severity");
    req.input("severity", sql.VarChar, filters.severity);
  }
  if (filters.ownerUserId) {
    clauses.push("i.OwnerUserId = @ownerUserId");
    req.input("ownerUserId", sql.Int, filters.ownerUserId);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const result = await req.query<{
    Id: number;
    Title: string;
    Severity: IncidentSeverity;
    AffectedSystem: string | null;
    Status: IncidentStatus;
    OwnerUsername: string | null;
    StartedAt: string;
    AcknowledgedAt: string | null;
    ResolvedAt: string | null;
    LinkedAlertCount: number;
  }>(`
    SELECT i.Id, i.Title, i.Severity, i.AffectedSystem, i.Status, ou.Username AS OwnerUsername,
      CONVERT(VARCHAR(33), i.StartedAt, 126) AS StartedAt,
      CONVERT(VARCHAR(33), i.AcknowledgedAt, 126) AS AcknowledgedAt,
      CONVERT(VARCHAR(33), i.ResolvedAt, 126) AS ResolvedAt,
      ISNULL(links.Cnt, 0) AS LinkedAlertCount
    FROM OpsIncidents i
    LEFT JOIN Users ou ON ou.Id = i.OwnerUserId
    OUTER APPLY (SELECT COUNT(*) AS Cnt FROM OpsIncidentSecurityAlerts a WHERE a.IncidentId = i.Id) links
    ${where}
    ORDER BY i.StartedAt DESC
  `);

  return result.recordset.map((r) => ({
    id: r.Id,
    title: r.Title,
    severity: r.Severity,
    affectedSystem: r.AffectedSystem,
    status: r.Status,
    ownerUsername: r.OwnerUsername,
    startedAt: r.StartedAt,
    acknowledgedAt: r.AcknowledgedAt,
    resolvedAt: r.ResolvedAt,
    linkedAlertCount: r.LinkedAlertCount,
  }));
}

export interface LinkedAlert {
  id: number;
  category: string;
  severity: string;
  status: string;
  createdAt: string;
}
export interface LinkedMonitorIncident {
  id: number;
  title: string;
  monitorName: string;
  severity: string;
  status: string;
}
export interface TimelineEntry {
  id: number;
  entryType: string;
  message: string;
  username: string | null;
  createdAt: string;
}
export interface AttachmentRow {
  id: number;
  originalFileName: string;
  contentType: string | null;
  sizeBytes: number;
  uploadedByUsername: string | null;
  createdAt: string;
}

export interface IncidentDetail {
  id: number;
  title: string;
  severity: IncidentSeverity;
  affectedSystem: string | null;
  status: IncidentStatus;
  ownerUserId: number | null;
  ownerUsername: string | null;
  startedAt: string;
  acknowledgedAt: string | null;
  acknowledgedByUsername: string | null;
  resolvedAt: string | null;
  resolvedByUsername: string | null;
  rootCause: string | null;
  fix: string | null;
  prevention: string | null;
  createdByUsername: string | null;
  linkedAlerts: LinkedAlert[];
  linkedMonitorIncidents: LinkedMonitorIncident[];
  timeline: TimelineEntry[];
  attachments: AttachmentRow[];
}

export async function getIncidentDetail(id: number): Promise<IncidentDetail | null> {
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).query(`
    SELECT i.*, ou.Username AS OwnerUsername, ak.Username AS AcknowledgedByUsername, rb.Username AS ResolvedByUsername
    FROM OpsIncidents i
    LEFT JOIN Users ou ON ou.Id = i.OwnerUserId
    LEFT JOIN Users ak ON ak.Id = i.AcknowledgedByUserId
    LEFT JOIN Users rb ON rb.Id = i.ResolvedByUserId
    WHERE i.Id = @id
  `);
  const row = result.recordset[0];
  if (!row) return null;

  const [alerts, monitorIncidents, timeline, attachments] = await Promise.all([
    db.request().input("id", sql.Int, id).query<{ Id: number; Category: string; Severity: string; Status: string; CreatedAt: string }>(`
      SELECT a.Id, a.Category, a.Severity, a.Status, CONVERT(VARCHAR(33), a.CreatedAt, 126) AS CreatedAt
      FROM OpsIncidentSecurityAlerts l JOIN SecurityAlerts a ON a.Id = l.AlertId
      WHERE l.IncidentId = @id ORDER BY a.CreatedAt DESC
    `),
    db.request().input("id", sql.Int, id).query<{ Id: number; Title: string; MonitorName: string; Severity: string; Status: string }>(`
      SELECT mi.Id, mi.Title, m.Name AS MonitorName, mi.Severity, mi.Status
      FROM OpsIncidentMonitorIncidents l JOIN Incidents mi ON mi.Id = l.MonitorIncidentId JOIN Monitors m ON m.Id = mi.MonitorId
      WHERE l.IncidentId = @id ORDER BY mi.StartedAt DESC
    `),
    db.request().input("id", sql.Int, id).query<{ Id: number; EntryType: string; Message: string; Username: string | null; CreatedAt: string }>(`
      SELECT Id, EntryType, Message, Username, CONVERT(VARCHAR(33), CreatedAt, 126) AS CreatedAt
      FROM OpsIncidentTimeline WHERE IncidentId = @id ORDER BY CreatedAt ASC
    `),
    db.request().input("id", sql.Int, id).query<{ Id: number; OriginalFileName: string; ContentType: string | null; SizeBytes: number; UploadedByUsername: string | null; CreatedAt: string }>(`
      SELECT Id, OriginalFileName, ContentType, SizeBytes, UploadedByUsername, CONVERT(VARCHAR(33), CreatedAt, 126) AS CreatedAt
      FROM OpsIncidentAttachments WHERE IncidentId = @id ORDER BY CreatedAt DESC
    `),
  ]);

  return {
    id: row.Id,
    title: row.Title,
    severity: row.Severity,
    affectedSystem: row.AffectedSystem,
    status: row.Status,
    ownerUserId: row.OwnerUserId,
    ownerUsername: row.OwnerUsername,
    startedAt: new Date(row.StartedAt).toISOString(),
    acknowledgedAt: row.AcknowledgedAt ? new Date(row.AcknowledgedAt).toISOString() : null,
    acknowledgedByUsername: row.AcknowledgedByUsername,
    resolvedAt: row.ResolvedAt ? new Date(row.ResolvedAt).toISOString() : null,
    resolvedByUsername: row.ResolvedByUsername,
    rootCause: row.RootCause,
    fix: row.Fix,
    prevention: row.Prevention,
    createdByUsername: row.CreatedByUsername,
    linkedAlerts: alerts.recordset.map((a) => ({ id: a.Id, category: a.Category, severity: a.Severity, status: a.Status, createdAt: a.CreatedAt })),
    linkedMonitorIncidents: monitorIncidents.recordset.map((m) => ({ id: m.Id, title: m.Title, monitorName: m.MonitorName, severity: m.Severity, status: m.Status })),
    timeline: timeline.recordset.map((t) => ({ id: t.Id, entryType: t.EntryType, message: t.Message, username: t.Username, createdAt: t.CreatedAt })),
    attachments: attachments.recordset.map((a) => ({ id: a.Id, originalFileName: a.OriginalFileName, contentType: a.ContentType, sizeBytes: a.SizeBytes, uploadedByUsername: a.UploadedByUsername, createdAt: a.CreatedAt })),
  };
}

export async function createIncident(
  input: { title: string; severity: IncidentSeverity; affectedSystem: string | null; ownerUserId: number | null; alertIds: number[]; monitorIncidentIds: number[] },
  actor: Actor
): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("title", sql.NVarChar, input.title)
    .input("severity", sql.VarChar, input.severity)
    .input("affectedSystem", sql.NVarChar, input.affectedSystem)
    .input("ownerUserId", sql.Int, input.ownerUserId)
    .input("createdByUserId", sql.Int, actor.userId)
    .input("createdByUsername", sql.NVarChar, actor.username)
    .query<{ Id: number }>(`
      INSERT INTO OpsIncidents (Title, Severity, AffectedSystem, OwnerUserId, CreatedByUserId, CreatedByUsername)
      OUTPUT INSERTED.Id
      VALUES (@title, @severity, @affectedSystem, @ownerUserId, @createdByUserId, @createdByUsername)
    `);
  const id = result.recordset[0].Id;

  await addTimelineEntry(id, "Created", `Incident created by ${actor.username}.`, actor);
  if (input.ownerUserId) await addTimelineEntry(id, "Assigned", `Assigned to owner (user #${input.ownerUserId}).`, actor);

  for (const alertId of input.alertIds) {
    await db.request().input("incidentId", sql.Int, id).input("alertId", sql.Int, alertId).query(
      "INSERT INTO OpsIncidentSecurityAlerts (IncidentId, AlertId) VALUES (@incidentId, @alertId)"
    );
    await addTimelineEntry(id, "AlertLinked", `Linked Security Alert #${alertId}.`, actor);
  }
  for (const monitorIncidentId of input.monitorIncidentIds) {
    await db.request().input("incidentId", sql.Int, id).input("monitorIncidentId", sql.Int, monitorIncidentId).query(
      "INSERT INTO OpsIncidentMonitorIncidents (IncidentId, MonitorIncidentId) VALUES (@incidentId, @monitorIncidentId)"
    );
    await addTimelineEntry(id, "AlertLinked", `Linked Monitor Incident #${monitorIncidentId}.`, actor);
  }

  return id;
}

export async function linkAlertsToIncident(incidentId: number, alertIds: number[], actor: Actor): Promise<void> {
  const db = await getDb();
  for (const alertId of alertIds) {
    const existing = await db.request().input("incidentId", sql.Int, incidentId).input("alertId", sql.Int, alertId).query<{ IncidentId: number }>(
      "SELECT IncidentId FROM OpsIncidentSecurityAlerts WHERE IncidentId = @incidentId AND AlertId = @alertId"
    );
    if (existing.recordset[0]) continue;
    await db.request().input("incidentId", sql.Int, incidentId).input("alertId", sql.Int, alertId).query(
      "INSERT INTO OpsIncidentSecurityAlerts (IncidentId, AlertId) VALUES (@incidentId, @alertId)"
    );
    await addTimelineEntry(incidentId, "AlertLinked", `Linked Security Alert #${alertId}.`, actor);
  }
}

export async function updateIncidentFields(
  incidentId: number,
  patch: Partial<{ title: string; severity: IncidentSeverity; affectedSystem: string | null; status: IncidentStatus; ownerUserId: number | null; rootCause: string | null; fix: string | null; prevention: string | null }>,
  actor: Actor
): Promise<void> {
  const db = await getDb();
  const current = await db.request().input("id", sql.Int, incidentId).query<{ Status: string; OwnerUserId: number | null }>(
    "SELECT Status, OwnerUserId FROM OpsIncidents WHERE Id = @id"
  );
  const before = current.recordset[0];
  if (!before) throw new Error("Incident not found.");

  const req = db.request().input("id", sql.Int, incidentId);
  const sets: string[] = ["UpdatedAt = SYSUTCDATETIME()"];
  if (patch.title !== undefined) {
    sets.push("Title = @title");
    req.input("title", sql.NVarChar, patch.title);
  }
  if (patch.severity !== undefined) {
    sets.push("Severity = @severity");
    req.input("severity", sql.VarChar, patch.severity);
  }
  if (patch.affectedSystem !== undefined) {
    sets.push("AffectedSystem = @affectedSystem");
    req.input("affectedSystem", sql.NVarChar, patch.affectedSystem);
  }
  if (patch.status !== undefined) {
    sets.push("Status = @status");
    req.input("status", sql.VarChar, patch.status);
  }
  if (patch.ownerUserId !== undefined) {
    sets.push("OwnerUserId = @ownerUserId");
    req.input("ownerUserId", sql.Int, patch.ownerUserId);
  }
  if (patch.rootCause !== undefined) {
    sets.push("RootCause = @rootCause");
    req.input("rootCause", sql.NVarChar(sql.MAX), patch.rootCause);
  }
  if (patch.fix !== undefined) {
    sets.push("Fix = @fix");
    req.input("fix", sql.NVarChar(sql.MAX), patch.fix);
  }
  if (patch.prevention !== undefined) {
    sets.push("Prevention = @prevention");
    req.input("prevention", sql.NVarChar(sql.MAX), patch.prevention);
  }
  if (sets.length === 1) return;

  await req.query(`UPDATE OpsIncidents SET ${sets.join(", ")} WHERE Id = @id`);

  if (patch.status !== undefined && patch.status !== before.Status) {
    await addTimelineEntry(incidentId, "StatusChanged", `Status changed from ${before.Status} to ${patch.status}.`, actor);
  }
  if (patch.ownerUserId !== undefined && patch.ownerUserId !== before.OwnerUserId) {
    await addTimelineEntry(incidentId, "Assigned", patch.ownerUserId ? `Reassigned to user #${patch.ownerUserId}.` : "Unassigned.", actor);
  }
  if (patch.rootCause !== undefined || patch.fix !== undefined || patch.prevention !== undefined) {
    await addTimelineEntry(incidentId, "SummaryUpdated", "Post-incident summary updated.", actor);
  }
}

export async function acknowledgeIncident(incidentId: number, actor: Actor): Promise<void> {
  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, incidentId)
    .input("userId", sql.Int, actor.userId)
    .query("UPDATE OpsIncidents SET AcknowledgedAt = SYSUTCDATETIME(), AcknowledgedByUserId = @userId, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id AND AcknowledgedAt IS NULL");
  if (result.rowsAffected[0] > 0) await addTimelineEntry(incidentId, "Acknowledged", `Acknowledged by ${actor.username}.`, actor);
}

export async function resolveIncident(incidentId: number, actor: Actor): Promise<void> {
  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, incidentId)
    .input("userId", sql.Int, actor.userId)
    .query("UPDATE OpsIncidents SET Status = 'Resolved', ResolvedAt = SYSUTCDATETIME(), ResolvedByUserId = @userId, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id AND ResolvedAt IS NULL");
  if (result.rowsAffected[0] > 0) await addTimelineEntry(incidentId, "Resolved", `Resolved by ${actor.username}.`, actor);
}

export async function addManualNote(incidentId: number, note: string, actor: Actor): Promise<void> {
  await addTimelineEntry(incidentId, "Note", note, actor);
}

export async function addAttachment(incidentId: number, file: { filePath: string; originalFileName: string; contentType: string | null; sizeBytes: number }, actor: Actor): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("incidentId", sql.Int, incidentId)
    .input("filePath", sql.NVarChar, file.filePath)
    .input("originalFileName", sql.NVarChar, file.originalFileName)
    .input("contentType", sql.NVarChar, file.contentType)
    .input("sizeBytes", sql.Int, file.sizeBytes)
    .input("userId", sql.Int, actor.userId)
    .input("username", sql.NVarChar, actor.username)
    .query<{ Id: number }>(`
      INSERT INTO OpsIncidentAttachments (IncidentId, FilePath, OriginalFileName, ContentType, SizeBytes, UploadedByUserId, UploadedByUsername)
      OUTPUT INSERTED.Id
      VALUES (@incidentId, @filePath, @originalFileName, @contentType, @sizeBytes, @userId, @username)
    `);
  await addTimelineEntry(incidentId, "Attachment", `${actor.username} attached ${file.originalFileName}.`, actor);
  return result.recordset[0].Id;
}

export async function recordKbArticleSaved(incidentId: number, kbDocumentId: number, actor: Actor): Promise<void> {
  await addTimelineEntry(incidentId, "KbSaved", `Saved as Knowledge Base article (#${kbDocumentId}).`, actor);
}
