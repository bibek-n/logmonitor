import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  console.log("=== RCSI / snapshot isolation settings ===");
  const dbOpts = await db.query(`
    SELECT name, is_read_committed_snapshot_on, snapshot_isolation_state_desc
    FROM sys.databases WHERE database_id = DB_ID()
  `);
  console.table(dbOpts.recordset);

  console.log("\n=== Current blocking (sys.dm_exec_requests) ===");
  const blocking = await db.query(`
    SELECT r.session_id, r.blocking_session_id, r.wait_type, r.wait_time, r.status, r.command,
      SUBSTRING(t.text, 1, 200) AS query_text
    FROM sys.dm_exec_requests r
    CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
    WHERE r.session_id != @@SPID
  `);
  console.table(blocking.recordset);

  console.log("\n=== Recent lock waits (sys.dm_os_wait_stats top waits) ===");
  const waits = await db.query(`
    SELECT TOP 10 wait_type, waiting_tasks_count, wait_time_ms, max_wait_time_ms
    FROM sys.dm_os_wait_stats
    WHERE wait_type LIKE 'LCK%' OR wait_type LIKE 'PAGEIOLATCH%' OR wait_type LIKE 'WRITELOG%'
    ORDER BY wait_time_ms DESC
  `);
  console.table(waits.recordset);

  console.log("\n=== Active/recent agent write volume (ServerLogEntries inserts in last 5 min by device) ===");
  const writes = await db.query(`
    SELECT d.DeviceName, COUNT(*) AS RowsInsertedLast5Min
    FROM ServerLogEntries s
    JOIN Devices d ON d.DeviceId = s.DeviceId
    WHERE s.ReceivedAt >= DATEADD(MINUTE, -5, SYSUTCDATETIME())
    GROUP BY d.DeviceName
    ORDER BY RowsInsertedLast5Min DESC
  `);
  console.table(writes.recordset);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
