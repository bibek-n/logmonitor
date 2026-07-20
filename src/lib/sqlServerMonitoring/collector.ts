import { getDb } from "@/lib/db";
import { runOneInstanceMssql } from "./collectorMssql";
import { runOneInstanceMysql } from "./collectorMysql";
import { runOneInstancePostgres } from "./collectorPostgres";
import type { InstanceCollectionResult, InstanceToCollect } from "./shared";

export type { InstanceCollectionResult } from "./shared";

// Dispatches each enabled instance to its engine-specific collector. All three write into the
// same tables in the app's own database (see persist.ts) - only how the source metrics are
// gathered differs per engine (see collectorMssql.ts / collectorMysql.ts / collectorPostgres.ts).
export async function runSqlServerMonitoringPass(): Promise<InstanceCollectionResult[]> {
  const db = await getDb();
  // The +'Z' matters: LastDownAlertAt is stored via SYSUTCDATETIME() (a UTC instant), but
  // CONVERT(...,126) alone strips any zone marker - new Date() on a bare "yyyy-mm-ddThh:mm:ss"
  // string parses it as LOCAL time, not UTC, silently shifting the cooldown math by this
  // server's UTC offset. Caught by a real end-to-end test that showed the down-alert firing
  // twice within the same minute instead of respecting the 1-hour cooldown.
  const instancesResult = await db.query<InstanceToCollect>`
    SELECT Id, Name, HostName, Port, AuthType, SqlUsername, SqlPasswordEncrypted, IsSelfMonitoring, Engine,
      LastCheckStatus, CONVERT(VARCHAR(19), LastDownAlertAt, 126) + 'Z' AS LastDownAlertAt,
      SshHost, SshPort, SshUsername, SshPasswordEncrypted, BackupBaseDir
    FROM SqlServerInstances WHERE Enabled = 1
  `;

  const results: InstanceCollectionResult[] = [];
  for (const instance of instancesResult.recordset) {
    if (instance.Engine === "mysql") {
      results.push(await runOneInstanceMysql(db, instance));
    } else if (instance.Engine === "postgres") {
      results.push(await runOneInstancePostgres(db, instance));
    } else {
      results.push(await runOneInstanceMssql(db, instance));
    }
  }
  return results;
}
