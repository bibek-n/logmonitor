import { NodeSSH } from "node-ssh";
import { decryptSqlPassword } from "./credentials";
import type { InstanceToCollect } from "./shared";

const DEFAULT_BACKUP_BASE_DIR = "/var/lib/automysqlbackup";
const SSH_TIMEOUT_MS = 10_000;

export interface BackupStatus {
  lastBackupAt: Date;
  lastBackupType: string; // "daily" | "weekly" | "monthly" - whichever tier's directory the newest file was found under
}

// AutoMySQLBackup (confirmed live against a real install) lays out its backup directory as
// <baseDir>/{daily,weekly,monthly}/<databaseName>/<databaseName>_....sql.gz - there is no
// backup catalog table anywhere (unlike SQL Server's msdb.dbo.backupset), so "when was this
// database last backed up" can only be answered by reading file mtimes over SSH. The
// directory tree is root:root mode 750 on a stock install, so the read needs sudo - this is
// safe to run non-interactively (`sudo -n`) rather than fail outright, since the whole point
// is a read-only status check, but if the configured SSH user has no passwordless sudo for
// `find`, this degrades to an empty map (no backup data) rather than throwing and failing the
// entire collection pass for every other metric.
export async function collectBackupStatusViaSsh(instance: InstanceToCollect): Promise<Map<string, BackupStatus>> {
  const result = new Map<string, BackupStatus>();
  if (!instance.SshHost || !instance.SshUsername || !instance.SshPasswordEncrypted) return result;

  const baseDir = instance.BackupBaseDir?.trim() || DEFAULT_BACKUP_BASE_DIR;
  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: instance.SshHost,
      port: instance.SshPort ?? 22,
      username: instance.SshUsername,
      password: decryptSqlPassword(instance.SshPasswordEncrypted),
      readyTimeout: SSH_TIMEOUT_MS,
    });

    // %T@ = mtime as epoch seconds (with fraction), %P = path relative to baseDir, e.g.
    // "daily/mydb/mydb_2026-07-17_01h00m.sql.gz" - mindepth/maxdepth 3 targets exactly
    // <tier>/<dbname>/<file>, skipping the tier and per-db directories themselves.
    const command = `sudo -n find ${JSON.stringify(baseDir)} -mindepth 3 -maxdepth 3 -type f -printf '%T@ %P\\n' 2>/dev/null`;
    const res = await ssh.execCommand(command);
    if (res.code !== 0 && !res.stdout.trim()) return result;

    for (const line of res.stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const spaceIdx = trimmed.indexOf(" ");
      if (spaceIdx === -1) continue;
      const epochSeconds = Number(trimmed.slice(0, spaceIdx));
      const relativePath = trimmed.slice(spaceIdx + 1);
      const [tier, databaseName] = relativePath.split("/");
      if (!tier || !databaseName || !Number.isFinite(epochSeconds)) continue;

      const candidate: BackupStatus = { lastBackupAt: new Date(epochSeconds * 1000), lastBackupType: tier };
      const existing = result.get(databaseName);
      if (!existing || candidate.lastBackupAt > existing.lastBackupAt) {
        result.set(databaseName, candidate);
      }
    }
  } catch (err) {
    console.error(`[backupStatusSsh] Failed to read backup status for "${instance.HostName}" via SSH:`, err instanceof Error ? err.message : err);
  } finally {
    ssh.dispose();
  }

  return result;
}
