import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// Optional SSH-based backup-status check for engines with no built-in backup catalog (MySQL
// has no msdb equivalent - see collectorMysql.ts's collectDatabases()). When an instance has
// SshHost set, backupStatusSsh.ts connects and reads file mtimes under a backup tool's own
// directory layout (currently: AutoMySQLBackup's {daily,weekly,monthly}/<dbname>/ structure -
// confirmed live against a real box) to populate the SAME LastBackupAt/LastBackupType columns
// on SqlServerDatabaseSnapshots that MSSQL's msdb-based check already writes. No new backup
// table needed - this is a second way to fill in columns that already existed.
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "SqlServerInstances", "SshHost", "NVARCHAR(255) NULL");
  await addColumnIfMissing(db, "SqlServerInstances", "SshPort", "INT NULL");
  await addColumnIfMissing(db, "SqlServerInstances", "SshUsername", "NVARCHAR(200) NULL");
  await addColumnIfMissing(db, "SqlServerInstances", "SshPasswordEncrypted", "NVARCHAR(MAX) NULL");
  await addColumnIfMissing(db, "SqlServerInstances", "BackupBaseDir", "NVARCHAR(500) NULL");

  console.log("SQL Server Monitoring v3 schema ready (optional SSH-based backup status check).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
