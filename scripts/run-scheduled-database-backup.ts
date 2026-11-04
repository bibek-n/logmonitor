import "dotenv/config";
import mssql from "mssql";
import { getDb, sql } from "../src/lib/db";

// Scheduled counterpart to the manual "Backup Now" button in Settings > Backup & Data
// (src/app/api/admin/settings/backup/route.ts). Runs every ~15 minutes via the "LogMonitor
// Database Backup" Windows scheduled task on the app server (same polling-task cadence as
// run-website-security-daily-scan.ts) and decides for itself whether a backup is actually
// due right now - this is what lets Settings > Backup & Data's schedule UI (frequency/time/
// retention count) actually mean something, instead of a fixed once-a-day run regardless of
// what's configured there.
//
// Retention: the database server (DB_SERVER=192.168.1.3) is a separate machine from this
// app server, and the SQL login this app connects with (logmonitor_app) is db_owner on
// LogMonitor only - not sysadmin - so it cannot delete arbitrary files on that server's disk
// (xp_delete_file and similar require sysadmin). Instead of deleting files, this rotates
// through N fixed backup-set filenames (slot0..slotN-1, N = BackupRetentionCount) and backs
// up WITH INIT each time, which tells SQL Server to overwrite the existing backup set in
// that file. Net effect is the same as "keep only the last N backups, delete anything older"
// - there are never more than N .bak files on disk - without needing any extra OS permissions.
const BACKUP_DIR = "C:\\SQLData\\MSSQL17.SQLEXPRESS\\MSSQL\\Backup"; // SQL Server's own default backup path on DB_SERVER - always writable by the engine itself.
const DEFAULT_RETENTION_SLOTS = 3;
const DEFAULT_RETENTION_DAYS = 3;
const DEFAULT_TIME = "01:30";
const TIME_TOLERANCE_MINUTES = 10;

interface BackupScheduleRow {
  BackupScheduleEnabled: boolean;
  BackupScheduleFrequency: string | null;
  BackupScheduleTime: string | null;
  BackupRetentionCount: number | null;
}

function timeMatchesNow(now: Date, hhmm: string, toleranceMinutes: number): boolean {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  return Math.abs(now.getTime() - target.getTime()) / 60000 <= toleranceMinutes;
}

// Is a custom-scheduled backup due right now? Daily/weekly/monthly are all "has it been at
// least this long since the last scheduled-task backup, and are we inside the configured
// time-of-day window" - there's no separate LastRunAt column for this (unlike per-website
// scan schedules), so "last run" is read back from BackupHistory itself.
function isCustomScheduleDue(now: Date, schedule: BackupScheduleRow, lastRunAt: Date | null): boolean {
  if (!timeMatchesNow(now, schedule.BackupScheduleTime ?? DEFAULT_TIME, TIME_TOLERANCE_MINUTES)) return false;
  if (!lastRunAt) return true;
  const daysSinceLastRun = (now.getTime() - lastRunAt.getTime()) / 86400000;
  switch (schedule.BackupScheduleFrequency) {
    case "weekly":
      return daysSinceLastRun >= 6.5;
    case "monthly":
      return daysSinceLastRun >= 27;
    default: // "daily" or unset
      return daysSinceLastRun >= 0.9;
  }
}

async function main() {
  const dbName = process.env.DB_DATABASE;
  if (!dbName) {
    console.error("DB_DATABASE is not configured.");
    process.exit(1);
  }

  const db = await getDb();
  const now = new Date();

  const scheduleResult = await db.query<BackupScheduleRow>`
    SELECT BackupScheduleEnabled, BackupScheduleFrequency, BackupScheduleTime, BackupRetentionCount
    FROM CompanySettings WHERE Id = 1
  `;
  const schedule = scheduleResult.recordset[0] ?? null;
  const scheduleEnabled = schedule?.BackupScheduleEnabled === true;
  const retentionSlots = scheduleEnabled ? Math.max(1, schedule?.BackupRetentionCount ?? DEFAULT_RETENTION_SLOTS) : DEFAULT_RETENTION_SLOTS;

  if (scheduleEnabled) {
    const lastRunResult = await db.query<{ LastRunAt: string | null }>(
      "SELECT MAX(CreatedAt) AS LastRunAt FROM BackupHistory WHERE TriggeredByUsername = 'scheduled-task'"
    );
    const lastRunAt = lastRunResult.recordset[0]?.LastRunAt ? new Date(lastRunResult.recordset[0].LastRunAt as string) : null;
    if (!isCustomScheduleDue(now, schedule!, lastRunAt)) {
      console.log("[scheduled-backup] custom schedule configured but not due yet - skipping this run.");
      process.exit(0);
    }
  } else if (!timeMatchesNow(now, DEFAULT_TIME, TIME_TOLERANCE_MINUTES)) {
    // No custom schedule - unchanged default behavior: once daily, ~01:30, same as before
    // this script started polling every 15 minutes instead of being triggered once a day.
    process.exit(0);
  }

  // Round-robins across however many scheduled-task backups already exist, mod the slot
  // count - gives a clean rotation regardless of frequency (daily/weekly/monthly all land on
  // slot0, slot1, slot2, ... in turn) rather than a day-of-epoch formula that only rotates
  // cleanly for a strictly-daily cadence.
  const priorRunsResult = await db.query<{ Cnt: number }>(
    "SELECT COUNT(*) AS Cnt FROM BackupHistory WHERE TriggeredByUsername = 'scheduled-task'"
  );
  const slot = (priorRunsResult.recordset[0]?.Cnt ?? 0) % retentionSlots;
  const fileName = `${dbName}_slot${slot}.bak`;
  const filePath = `${BACKUP_DIR}\\${fileName}`;

  let status: "success" | "failed" = "success";
  let errorMessage: string | null = null;
  let sizeBytes: number | null = null;

  // Same long-timeout dedicated connection as the manual backup route - BACKUP DATABASE on
  // a real production database routinely runs past the shared pool's 15s default timeout.
  let backupPool: mssql.ConnectionPool | null = null;
  try {
    backupPool = await new mssql.ConnectionPool({
      server: process.env.DB_SERVER!,
      database: process.env.DB_DATABASE!,
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      options: { trustServerCertificate: true, encrypt: false },
      requestTimeout: 10 * 60 * 1000,
      connectionTimeout: 30000,
    }).connect();

    await backupPool!
      .request()
      .input("filePath", sql.NVarChar, filePath)
      .query(`BACKUP DATABASE [${dbName.replace(/]/g, "]]")}] TO DISK = @filePath WITH INIT, COMPRESSION`);

    // The backup file lives on the DB server's own disk, not this app server's - read the
    // size back from SQL Server's own backup history instead of fs.stat-ing a local path.
    // compressed_backup_size, not backup_size (which is the uncompressed data size and
    // wildly overstates how much disk the .bak file actually occupies with WITH COMPRESSION).
    const sizeResult = await backupPool!
      .request()
      .input("filePath", sql.NVarChar, filePath)
      .query(`
        SELECT TOP 1 bs.compressed_backup_size
        FROM msdb.dbo.backupset bs
        JOIN msdb.dbo.backupmediafamily bmf ON bmf.media_set_id = bs.media_set_id
        WHERE bmf.physical_device_name = @filePath
        ORDER BY bs.backup_finish_date DESC
      `);
    sizeBytes = sizeResult.recordset[0]?.compressed_backup_size ?? null;
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : String(err);
  } finally {
    await backupPool?.close().catch(() => {});
  }

  await db
    .request()
    .input("fileName", sql.NVarChar, fileName)
    .input("filePath", sql.NVarChar, filePath)
    .input("sizeBytes", sql.BigInt, sizeBytes)
    .input("status", sql.VarChar, status)
    .input("errorMessage", sql.NVarChar, errorMessage)
    .input("triggeredByUsername", sql.NVarChar, "scheduled-task")
    .query(`
      INSERT INTO BackupHistory (FileName, FilePath, SizeBytes, Status, ErrorMessage, TriggeredByUsername)
      VALUES (@fileName, @filePath, @sizeBytes, @status, @errorMessage, @triggeredByUsername)
    `);

  // Retention for the history log itself (separate from the slot file rotation above). With
  // a custom schedule, "days" doesn't map cleanly onto weekly/monthly cadences, so it keeps
  // the latest N scheduled-task rows instead (N = the same retention count driving the file
  // rotation); the no-custom-schedule default keeps the original fixed 3-day window.
  const prunedCount = scheduleEnabled
    ? (
        await db.request().input("keep", sql.Int, retentionSlots).query(`
          DELETE FROM BackupHistory OUTPUT deleted.Id
          WHERE TriggeredByUsername = 'scheduled-task' AND Id NOT IN (
            SELECT TOP (@keep) Id FROM BackupHistory WHERE TriggeredByUsername = 'scheduled-task' ORDER BY CreatedAt DESC
          )
        `)
      ).recordset.length
    : (
        await db.request().input("days", sql.Int, DEFAULT_RETENTION_DAYS).query(
          "DELETE FROM BackupHistory OUTPUT deleted.Id WHERE CreatedAt < DATEADD(day, -@days, SYSUTCDATETIME())"
        )
      ).recordset.length;

  console.log(
    `Backup ${status} -> ${fileName} (${sizeBytes ?? "unknown"} bytes). Pruned ${prunedCount} BackupHistory row(s).${errorMessage ? ` Error: ${errorMessage}` : ""}`
  );
  process.exit(status === "success" ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
