import { getDb, sql } from "../db";
import { sendNotificationEmail } from "../notifyEmail";
import { getItAssetSettings } from "./repository";

export type AlertSeverity = "Critical" | "High" | "Medium" | "Low";

export interface AlertCandidate {
  alertType: string;
  assetId: number | null;
  sourceTable: string;
  sourceRecordId: number;
  severity: AlertSeverity;
  title: string;
  message: string;
}

// Pure dedup decision, split out from generateAlerts() so it's unit-testable without a DB:
// a candidate is only worth inserting if no UNREAD notification already exists for the exact
// same (AlertType, SourceTable, SourceRecordId) triple - once dismissed (read), the same
// underlying condition is allowed to re-alert on the next run (e.g. a password that was
// "DueSoon", got marked read, and is now "Overdue" a week later deserves a fresh alert).
export function shouldCreateAlert(candidate: Pick<AlertCandidate, "alertType" | "sourceTable" | "sourceRecordId">, existingUnread: { alertType: string; sourceTable: string; sourceRecordId: number }[]): boolean {
  return !existingUnread.some((e) => e.alertType === candidate.alertType && e.sourceTable === candidate.sourceTable && e.sourceRecordId === candidate.sourceRecordId);
}

interface Row {
  Id: number;
  AssetId: number;
  AssetTag: string;
  [key: string]: unknown;
}

async function findCandidates(): Promise<AlertCandidate[]> {
  const db = await getDb();
  const settings = await getItAssetSettings();
  const candidates: AlertCandidate[] = [];

  const passwordOverdue = await db.query<Row>`
    SELECT p.Id, p.AssetId, a.AssetTag, p.AccountOrServiceName, p.NextPasswordChangeDate
    FROM PasswordChangeLogs p JOIN Assets a ON a.Id = p.AssetId
    WHERE p.IsDeleted = 0 AND p.Status = 'Overdue'
  `;
  for (const r of passwordOverdue.recordset) {
    candidates.push({
      alertType: "PasswordOverdue", assetId: r.AssetId, sourceTable: "PasswordChangeLogs", sourceRecordId: r.Id, severity: "Critical",
      title: `Password rotation overdue - ${r.AssetTag}`,
      message: `${r.AccountOrServiceName} on ${r.AssetTag} was due for a password change on ${r.NextPasswordChangeDate} and has not been rotated.`,
    });
  }

  const passwordDueSoon = await db.query<Row>`
    SELECT p.Id, p.AssetId, a.AssetTag, p.AccountOrServiceName, p.NextPasswordChangeDate
    FROM PasswordChangeLogs p JOIN Assets a ON a.Id = p.AssetId
    WHERE p.IsDeleted = 0 AND p.Status IN ('DueSoon','DueToday')
  `;
  for (const r of passwordDueSoon.recordset) {
    candidates.push({
      alertType: "PasswordDueSoon", assetId: r.AssetId, sourceTable: "PasswordChangeLogs", sourceRecordId: r.Id, severity: "Medium",
      title: `Password rotation due soon - ${r.AssetTag}`,
      message: `${r.AccountOrServiceName} on ${r.AssetTag} is due for a password change on ${r.NextPasswordChangeDate}.`,
    });
  }

  const criticalPatches = await db.query<Row>`
    SELECT p.Id, p.AssetId, a.AssetTag, p.PatchName
    FROM PatchUpdateLogs p JOIN Assets a ON a.Id = p.AssetId
    WHERE p.IsDeleted = 0 AND p.Severity = 'Critical' AND p.InstallationStatus IN ('Planned','Scheduled','InProgress')
  `;
  for (const r of criticalPatches.recordset) {
    candidates.push({
      alertType: "CriticalPatchPending", assetId: r.AssetId, sourceTable: "PatchUpdateLogs", sourceRecordId: r.Id, severity: "Critical",
      title: `Critical patch pending - ${r.AssetTag}`,
      message: `${r.PatchName} is a critical-severity patch still pending installation on ${r.AssetTag}.`,
    });
  }

  const failedPatches = await db.query<Row>`
    SELECT p.Id, p.AssetId, a.AssetTag, p.PatchName, p.FailureReason
    FROM PatchUpdateLogs p JOIN Assets a ON a.Id = p.AssetId
    WHERE p.IsDeleted = 0 AND p.InstallationStatus = 'Failed'
  `;
  for (const r of failedPatches.recordset) {
    candidates.push({
      alertType: "PatchInstallFailed", assetId: r.AssetId, sourceTable: "PatchUpdateLogs", sourceRecordId: r.Id, severity: "High",
      title: `Patch installation failed - ${r.AssetTag}`,
      message: `${r.PatchName} failed to install on ${r.AssetTag}.${r.FailureReason ? ` Reason: ${r.FailureReason}` : ""}`,
    });
  }

  const unsupportedSoftware = await db.query<Row>`
    SELECT sw.Id, sw.AssetId, a.AssetTag, sw.SoftwareName
    FROM SoftwareInventory sw JOIN Assets a ON a.Id = sw.AssetId
    WHERE sw.IsDeleted = 0 AND sw.SoftwareStatus = 'Unsupported'
  `;
  for (const r of unsupportedSoftware.recordset) {
    candidates.push({
      alertType: "SoftwareUnsupported", assetId: r.AssetId, sourceTable: "SoftwareInventory", sourceRecordId: r.Id, severity: "Medium",
      title: `Unsupported software - ${r.AssetTag}`,
      message: `${r.SoftwareName} on ${r.AssetTag} is no longer supported by its vendor.`,
    });
  }

  const licencesExpiring = await db
    .request()
    .input("days", sql.Int, settings.licenceExpiryWarningDays)
    .query<Row>(`
      SELECT sw.Id, sw.AssetId, a.AssetTag, sw.SoftwareName, sw.LicenceExpiryDate
      FROM SoftwareInventory sw JOIN Assets a ON a.Id = sw.AssetId
      WHERE sw.IsDeleted = 0 AND sw.LicenceExpiryDate IS NOT NULL AND sw.LicenceExpiryDate <= DATEADD(DAY, @days, SYSUTCDATETIME())
    `);
  for (const r of licencesExpiring.recordset) {
    candidates.push({
      alertType: "LicenceExpiringSoon", assetId: r.AssetId, sourceTable: "SoftwareInventory", sourceRecordId: r.Id, severity: "Medium",
      title: `Licence expiring soon - ${r.AssetTag}`,
      message: `The licence for ${r.SoftwareName} on ${r.AssetTag} expires on ${r.LicenceExpiryDate}.`,
    });
  }

  const maintenanceOverdue = await db.query<Row>`
    SELECT m.Id, m.AssetId, a.AssetTag, m.ActivityTitle, m.ScheduledDate
    FROM MaintenanceLogs m JOIN Assets a ON a.Id = m.AssetId
    WHERE m.IsDeleted = 0 AND m.Status IN ('Planned','Scheduled') AND m.ScheduledDate < CAST(SYSUTCDATETIME() AS DATE)
  `;
  for (const r of maintenanceOverdue.recordset) {
    candidates.push({
      alertType: "MaintenanceOverdue", assetId: r.AssetId, sourceTable: "MaintenanceLogs", sourceRecordId: r.Id, severity: "High",
      title: `Maintenance overdue - ${r.AssetTag}`,
      message: `${r.ActivityTitle} on ${r.AssetTag} was scheduled for ${r.ScheduledDate} and has not been completed.`,
    });
  }

  const maintenanceDueSoon = await db
    .request()
    .input("days", sql.Int, settings.maintenanceDueSoonDays)
    .query<Row>(`
      SELECT m.Id, m.AssetId, a.AssetTag, m.ActivityTitle, m.ScheduledDate
      FROM MaintenanceLogs m JOIN Assets a ON a.Id = m.AssetId
      WHERE m.IsDeleted = 0 AND m.Status IN ('Planned','Scheduled')
        AND m.ScheduledDate >= CAST(SYSUTCDATETIME() AS DATE) AND m.ScheduledDate <= DATEADD(DAY, @days, SYSUTCDATETIME())
    `);
  for (const r of maintenanceDueSoon.recordset) {
    candidates.push({
      alertType: "MaintenanceDueSoon", assetId: r.AssetId, sourceTable: "MaintenanceLogs", sourceRecordId: r.Id, severity: "Low",
      title: `Maintenance due soon - ${r.AssetTag}`,
      message: `${r.ActivityTitle} on ${r.AssetTag} is scheduled for ${r.ScheduledDate}.`,
    });
  }

  const warrantyExpiring = await db
    .request()
    .input("days", sql.Int, settings.warrantyExpiryWarningDays)
    .query<Row>(`
      SELECT Id, Id AS AssetId, AssetTag, WarrantyExpiryDate FROM Assets
      WHERE IsDeleted = 0 AND Status NOT IN ('Retired','Disposed') AND WarrantyExpiryDate IS NOT NULL
        AND WarrantyExpiryDate <= DATEADD(DAY, @days, SYSUTCDATETIME())
    `);
  for (const r of warrantyExpiring.recordset) {
    candidates.push({
      alertType: "WarrantyExpiringSoon", assetId: r.AssetId, sourceTable: "Assets", sourceRecordId: r.Id, severity: "Low",
      title: `Warranty expiring soon - ${r.AssetTag}`,
      message: `The warranty for ${r.AssetTag} expires on ${r.WarrantyExpiryDate}.`,
    });
  }

  const notChecked = await db.query<Row>`
    SELECT Id, Id AS AssetId, AssetTag, NextInventoryCheckDate FROM Assets
    WHERE IsDeleted = 0 AND Status NOT IN ('Retired','Disposed')
      AND (NextInventoryCheckDate IS NULL OR NextInventoryCheckDate < CAST(SYSUTCDATETIME() AS DATE))
  `;
  for (const r of notChecked.recordset) {
    candidates.push({
      alertType: "AssetNotCheckedRecently", assetId: r.AssetId, sourceTable: "Assets", sourceRecordId: r.Id, severity: "Low",
      title: `Inventory check overdue - ${r.AssetTag}`,
      message: `${r.AssetTag} has ${r.NextInventoryCheckDate ? `an overdue inventory check (was due ${r.NextInventoryCheckDate})` : "never had an inventory check recorded"}.`,
    });
  }

  return candidates;
}

// Generates ItAssetNotifications rows for any threshold breach that doesn't already have an
// unread notification (see shouldCreateAlert). Sends an immediate email per newly-created
// Critical-severity alert when criticalAssetsAlertImmediately is on - everything else (any
// severity) goes out in the batched digest sendPendingNotificationEmails() sends separately,
// so a Critical item is never stuck waiting for the next scheduled digest.
export async function generateAlerts(): Promise<{ created: number }> {
  const db = await getDb();
  const settings = await getItAssetSettings();
  const candidates = await findCandidates();

  const existingResult = await db.query<{ AlertType: string; SourceTable: string; SourceRecordId: number }>(
    "SELECT AlertType, SourceTable, SourceRecordId FROM ItAssetNotifications WHERE IsRead = 0"
  );
  const existingUnread = existingResult.recordset.map((r) => ({ alertType: r.AlertType, sourceTable: r.SourceTable, sourceRecordId: r.SourceRecordId }));

  let created = 0;
  for (const candidate of candidates) {
    if (!shouldCreateAlert(candidate, existingUnread)) continue;

    const insertResult = await db
      .request()
      .input("alertType", sql.VarChar, candidate.alertType)
      .input("assetId", sql.Int, candidate.assetId)
      .input("sourceTable", sql.VarChar, candidate.sourceTable)
      .input("sourceRecordId", sql.Int, candidate.sourceRecordId)
      .input("severity", sql.VarChar, candidate.severity)
      .input("title", sql.NVarChar, candidate.title)
      .input("message", sql.NVarChar, candidate.message)
      .query<{ Id: number }>(`
        INSERT INTO ItAssetNotifications (AlertType, AssetId, SourceTable, SourceRecordId, Severity, Title, Message)
        OUTPUT INSERTED.Id
        VALUES (@alertType, @assetId, @sourceTable, @sourceRecordId, @severity, @title, @message)
      `);
    created++;
    existingUnread.push({ alertType: candidate.alertType, sourceTable: candidate.sourceTable, sourceRecordId: candidate.sourceRecordId });

    if (settings.emailAlertsEnabled && settings.criticalAssetsAlertImmediately && candidate.severity === "Critical" && settings.notificationRecipients.length > 0) {
      const notificationId = insertResult.recordset[0].Id;
      const result = await sendNotificationEmail({
        to: settings.notificationRecipients.join(","),
        subject: `[IT Asset Logsheet - Critical] ${candidate.title}`,
        body: candidate.message,
      });
      if (result.success) {
        await db.request().input("id", sql.Int, notificationId).query("UPDATE ItAssetNotifications SET EmailSentAt = SYSUTCDATETIME() WHERE Id = @id");
      }
    }
  }

  return { created };
}

// Sends one digest email (not one email per alert) covering everything not yet emailed -
// notificationRecipients only; escalationRecipients/escalationAfterDays are intentionally not
// wired up yet, since ItAssetNotifications has no column to track "already escalated" without
// a schema change, and re-escalating the same item every run would just be spam. Recorded here
// as a known gap rather than silently doing nothing about those two settings fields.
export async function sendPendingNotificationEmails(): Promise<{ sent: number }> {
  const settings = await getItAssetSettings();
  if (!settings.emailAlertsEnabled || settings.notificationRecipients.length === 0) return { sent: 0 };

  const db = await getDb();
  const pending = await db.query<{ Id: number; Title: string; Message: string; Severity: string }>(
    "SELECT Id, Title, Message, Severity FROM ItAssetNotifications WHERE EmailSentAt IS NULL AND IsRead = 0 ORDER BY CreatedAt ASC"
  );
  if (pending.recordset.length === 0) return { sent: 0 };

  const lines = pending.recordset.map((r) => `[${r.Severity}] ${r.Title}\n${r.Message}`);
  const body = `The following IT Asset Logsheet alerts need attention:\n\n${lines.join("\n\n")}`;

  const result = await sendNotificationEmail({
    to: settings.notificationRecipients.join(","),
    subject: `IT Asset Logsheet - ${pending.recordset.length} alert(s) need attention`,
    body,
  });

  if (result.success) {
    const ids = pending.recordset.map((r) => r.Id).join(",");
    await db.query(`UPDATE ItAssetNotifications SET EmailSentAt = SYSUTCDATETIME() WHERE Id IN (${ids})`);
  }

  return { sent: result.success ? pending.recordset.length : 0 };
}

export interface NotificationRow {
  id: number;
  alertType: string;
  assetId: number | null;
  assetTag: string | null;
  severity: AlertSeverity;
  title: string;
  message: string | null;
  isRead: boolean;
  createdAt: Date;
}

export async function listNotifications(filter: { isRead?: boolean; severity?: string; page?: number; pageSize?: number }): Promise<{ notifications: NotificationRow[]; total: number }> {
  const db = await getDb();
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filter.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  const req = db
    .request()
    .input("isRead", sql.Bit, filter.isRead === undefined ? null : filter.isRead)
    .input("severity", sql.VarChar, filter.severity ?? null)
    .input("offset", sql.Int, offset)
    .input("pageSize", sql.Int, pageSize);

  const where = "WHERE (@isRead IS NULL OR n.IsRead = @isRead) AND (@severity IS NULL OR n.Severity = @severity)";

  const [rows, count] = await Promise.all([
    req.query<{ Id: number; AlertType: string; AssetId: number | null; AssetTag: string | null; Severity: string; Title: string; Message: string | null; IsRead: boolean; CreatedAt: Date }>(`
      SELECT n.Id, n.AlertType, n.AssetId, a.AssetTag, n.Severity, n.Title, n.Message, n.IsRead, n.CreatedAt
      FROM ItAssetNotifications n LEFT JOIN Assets a ON a.Id = n.AssetId
      ${where} ORDER BY n.CreatedAt DESC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `),
    req.query<{ Total: number }>(`SELECT COUNT(*) AS Total FROM ItAssetNotifications n ${where}`),
  ]);

  return {
    notifications: rows.recordset.map((r) => ({
      id: r.Id, alertType: r.AlertType, assetId: r.AssetId, assetTag: r.AssetTag,
      severity: r.Severity as AlertSeverity, title: r.Title, message: r.Message, isRead: r.IsRead, createdAt: r.CreatedAt,
    })),
    total: count.recordset[0].Total,
  };
}

export async function markNotificationRead(id: number, userId: number): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, id)
    .input("userId", sql.Int, userId)
    .query("UPDATE ItAssetNotifications SET IsRead = 1, ReadByUserId = @userId, ReadAt = SYSUTCDATETIME() WHERE Id = @id");
}

export async function markAllNotificationsRead(userId: number): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("userId", sql.Int, userId)
    .query("UPDATE ItAssetNotifications SET IsRead = 1, ReadByUserId = @userId, ReadAt = SYSUTCDATETIME() WHERE IsRead = 0");
  return (result as unknown as { rowsAffected?: number[] }).rowsAffected?.[0] ?? 0;
}

export async function countUnreadNotifications(): Promise<number> {
  const db = await getDb();
  const result = await db.query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM ItAssetNotifications WHERE IsRead = 0");
  return result.recordset[0]?.Cnt ?? 0;
}
