import fs from "fs/promises";
import crypto from "crypto";
import { getDb, sql } from "@/lib/db";
import { dispatchAlertNotifications } from "./notificationChannels";

// File-integrity monitoring for this application's OWN critical files on the host it runs on
// (192.168.1.15) - e.g. web.config, appsettings/.env, next.config.js - not the endpoint-agent
// "WatchedFiles" feature (agent/fileintegrity.go), which is a separate, already-shipped feature
// for remote managed devices. This is IDS protecting itself/its own host, hence living under
// intrusionDetection rather than extending the agent feature. Same SHA-256 hex hashing
// convention as agent/fileintegrity.go for consistency across the app.

export interface FileIntegrityBaselineRow {
  id: number;
  filePath: string;
  sha256Hash: string;
  sizeBytes: number;
  permissions: string | null;
  approvedByUserId: number | null;
  lastVerifiedAt: string;
  createdAt: string;
}

export interface FileIntegrityEventRow {
  id: number;
  filePath: string;
  changeType: "Created" | "Modified" | "Deleted";
  oldHash: string | null;
  newHash: string | null;
  detectedAt: string;
  acknowledged: boolean;
}

interface BaselineDbRow {
  Id: number;
  FilePath: string;
  Sha256Hash: string;
  SizeBytes: number;
  Permissions: string | null;
  ApprovedByUserId: number | null;
  LastVerifiedAt: string;
  CreatedAt: string;
}

function toBaselineRow(r: BaselineDbRow): FileIntegrityBaselineRow {
  return {
    id: r.Id,
    filePath: r.FilePath,
    sha256Hash: r.Sha256Hash,
    sizeBytes: r.SizeBytes,
    permissions: r.Permissions,
    approvedByUserId: r.ApprovedByUserId,
    lastVerifiedAt: r.LastVerifiedAt,
    createdAt: r.CreatedAt,
  };
}

export interface FileSnapshot {
  sha256Hash: string;
  sizeBytes: number;
  permissions: string;
}

// Windows has no POSIX permission bits - fs.Stats.mode on Windows only reflects the read-only
// attribute, not a real ACL. Reported honestly as an octal string (matching this app's existing
// convention in agent/fileintegrity.go of disclosing attribution/permission limitations in the
// UI rather than pretending to have data this host can't provide) rather than omitted entirely.
export async function snapshotFile(filePath: string): Promise<FileSnapshot | null> {
  try {
    const [buffer, stat] = await Promise.all([fs.readFile(filePath), fs.stat(filePath)]);
    const sha256Hash = crypto.createHash("sha256").update(buffer).digest("hex");
    return { sha256Hash, sizeBytes: stat.size, permissions: (stat.mode & 0o777).toString(8) };
  } catch {
    return null;
  }
}

export async function listBaselines(): Promise<FileIntegrityBaselineRow[]> {
  const db = await getDb();
  const result = await db.query<BaselineDbRow>("SELECT * FROM SecurityFileIntegrityBaselines ORDER BY FilePath ASC");
  return result.recordset.map(toBaselineRow);
}

export async function addBaseline(filePath: string, approvedByUserId: number): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const snapshot = await snapshotFile(filePath);
  if (!snapshot) return { ok: false, error: `Could not read "${filePath}" - check the path is correct and readable by the application pool identity.` };

  const db = await getDb();
  const existing = await db.request().input("filePath", sql.NVarChar, filePath).query<{ Id: number }>("SELECT Id FROM SecurityFileIntegrityBaselines WHERE FilePath = @filePath");
  if (existing.recordset[0]) return { ok: false, error: "This file is already being monitored." };

  const result = await db
    .request()
    .input("filePath", sql.NVarChar, filePath)
    .input("sha256Hash", sql.Char(64), snapshot.sha256Hash)
    .input("sizeBytes", sql.BigInt, snapshot.sizeBytes)
    .input("permissions", sql.NVarChar, snapshot.permissions)
    .input("approvedByUserId", sql.Int, approvedByUserId)
    .query<{ Id: number }>(`
      INSERT INTO SecurityFileIntegrityBaselines (FilePath, Sha256Hash, SizeBytes, Permissions, ApprovedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@filePath, @sha256Hash, @sizeBytes, @permissions, @approvedByUserId)
    `);
  return { ok: true, id: result.recordset[0].Id };
}

export async function removeBaseline(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query("DELETE FROM SecurityFileIntegrityBaselines WHERE Id = @id");
}

async function recordEvent(filePath: string, changeType: FileIntegrityEventRow["changeType"], oldHash: string | null, newHash: string | null): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("filePath", sql.NVarChar, filePath)
    .input("changeType", sql.VarChar, changeType)
    .input("oldHash", sql.Char(64), oldHash)
    .input("newHash", sql.Char(64), newHash)
    .query<{ Id: number }>(`
      INSERT INTO SecurityFileIntegrityEvents (FilePath, ChangeType, OldHash, NewHash)
      OUTPUT INSERTED.Id
      VALUES (@filePath, @changeType, @oldHash, @newHash)
    `);
  return result.recordset[0].Id;
}

// A file-integrity change is reported as a normal SecurityAlerts row (Category: "file_integrity",
// already a valid AttackCategory value in shared.ts) so it surfaces in the same Alerts feed,
// investigation UI, and notification pipeline as every rule-engine-detected attack - a modified
// web.config is exactly as actionable as a detected SQL injection attempt, and analysts
// shouldn't need a second place to look for it.
async function createFileIntegrityAlert(filePath: string, changeType: string, detail: string): Promise<number> {
  const db = await getDb();
  const severity = changeType === "Deleted" ? "critical" : "high";
  const result = await db
    .request()
    .input("category", sql.VarChar, "file_integrity")
    .input("severity", sql.VarChar, severity)
    .input("requestPath", sql.NVarChar, filePath)
    .input("evidenceSummary", sql.NVarChar, detail)
    .input("recommendedAction", sql.NVarChar, "Verify this change was an authorized deployment/config update. If not, treat the host as potentially compromised and investigate immediately.")
    .input("groupingKey", sql.NVarChar, `file_integrity:${filePath}`)
    .query<{ Id: number }>(`
      INSERT INTO SecurityAlerts
        (RuleId, ProtectedApplicationId, Category, Severity, Confidence, RiskScore, RequestPath, EvidenceSummary, RecommendedAction, Status, GroupingKey, FirstSeenAt, LastSeenAt, OccurrenceCount)
      OUTPUT INSERTED.Id
      VALUES
        (NULL, NULL, @category, @severity, 95, ${severity === "critical" ? 95 : 80}, @requestPath, @evidenceSummary, @recommendedAction, 'New', @groupingKey, SYSUTCDATETIME(), SYSUTCDATETIME(), 1)
    `);
  const alertId = result.recordset[0].Id;
  await db.request().input("alertId", sql.Int, alertId).input("newStatus", sql.VarChar, "New").query(`
    INSERT INTO SecurityAlertStatusHistory (AlertId, OldStatus, NewStatus, Reason) VALUES (@alertId, NULL, @newStatus, 'Created by file integrity monitor')
  `);
  return alertId;
}

export interface FileIntegrityCheckSummary {
  checked: number;
  unchanged: number;
  modified: number;
  deleted: number;
}

// Re-checks every baseline against the file's current on-disk state. A detected change both
// records a SecurityFileIntegrityEvents row (this module's own detail log) AND re-baselines to
// the new hash immediately - otherwise every subsequent run would re-alert on the same already-
// reported change forever. Re-baselining after alerting (not before) means the alert always
// reflects a real transition, never a no-op.
export async function checkFileIntegrity(): Promise<FileIntegrityCheckSummary> {
  const baselines = await listBaselines();
  const db = await getDb();
  const summary: FileIntegrityCheckSummary = { checked: 0, unchanged: 0, modified: 0, deleted: 0 };

  for (const baseline of baselines) {
    summary.checked++;
    const snapshot = await snapshotFile(baseline.filePath);

    if (!snapshot) {
      summary.deleted++;
      await recordEvent(baseline.filePath, "Deleted", baseline.sha256Hash, null);
      const alertId = await createFileIntegrityAlert(baseline.filePath, "Deleted", `Monitored file "${baseline.filePath}" is missing or unreadable (was ${baseline.sha256Hash.slice(0, 12)}...).`);
      await removeBaseline(baseline.id);
      await dispatchAlertNotifications({
        alertId,
        severity: "critical",
        subject: `[CRITICAL] File integrity - deleted: ${baseline.filePath}`,
        body: `Monitored file "${baseline.filePath}" was deleted or became unreadable. Alert #${alertId}.`,
      }).catch(() => {});
      continue;
    }

    if (snapshot.sha256Hash === baseline.sha256Hash) {
      summary.unchanged++;
      await db.request().input("id", sql.Int, baseline.id).query("UPDATE SecurityFileIntegrityBaselines SET LastVerifiedAt = SYSUTCDATETIME() WHERE Id = @id");
      continue;
    }

    summary.modified++;
    await recordEvent(baseline.filePath, "Modified", baseline.sha256Hash, snapshot.sha256Hash);
    const alertId = await createFileIntegrityAlert(
      baseline.filePath,
      "Modified",
      `Monitored file "${baseline.filePath}" changed: hash ${baseline.sha256Hash.slice(0, 12)}... -> ${snapshot.sha256Hash.slice(0, 12)}..., size ${baseline.sizeBytes} -> ${snapshot.sizeBytes} bytes.`
    );
    await db
      .request()
      .input("id", sql.Int, baseline.id)
      .input("sha256Hash", sql.Char(64), snapshot.sha256Hash)
      .input("sizeBytes", sql.BigInt, snapshot.sizeBytes)
      .input("permissions", sql.NVarChar, snapshot.permissions)
      .query("UPDATE SecurityFileIntegrityBaselines SET Sha256Hash = @sha256Hash, SizeBytes = @sizeBytes, Permissions = @permissions, LastVerifiedAt = SYSUTCDATETIME() WHERE Id = @id");
    await dispatchAlertNotifications({
      alertId,
      severity: "high",
      subject: `[HIGH] File integrity - modified: ${baseline.filePath}`,
      body: `Monitored file "${baseline.filePath}" was modified. Alert #${alertId}.`,
    }).catch(() => {});
  }

  return summary;
}

export async function listEvents(limit = 100): Promise<FileIntegrityEventRow[]> {
  const db = await getDb();
  const result = await db.request().input("limit", sql.Int, limit).query<{
    Id: number; FilePath: string; ChangeType: string; OldHash: string | null; NewHash: string | null; DetectedAt: string; Acknowledged: boolean;
  }>("SELECT TOP (@limit) * FROM SecurityFileIntegrityEvents ORDER BY DetectedAt DESC");
  return result.recordset.map((r) => ({
    id: r.Id, filePath: r.FilePath, changeType: r.ChangeType as FileIntegrityEventRow["changeType"],
    oldHash: r.OldHash, newHash: r.NewHash, detectedAt: r.DetectedAt, acknowledged: r.Acknowledged,
  }));
}

export async function acknowledgeEvent(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query("UPDATE SecurityFileIntegrityEvents SET Acknowledged = 1 WHERE Id = @id");
}
