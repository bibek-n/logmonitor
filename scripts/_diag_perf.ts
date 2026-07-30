import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

const TABLES = [
  "ServerLogEntries",
  "DeviceMetrics",
  "DeviceHardwareInfo",
  "DeviceDisks",
  "DeviceVolumes",
  "DeviceNetworkInterfaces",
  "DeviceServiceSnapshot",
  "IisAppPools",
  "IisSites",
  "IisWorkerProcesses",
  "IisPerfSnapshots",
  "LinuxSecurityStatus",
  "LinuxOpenPorts",
  "LinuxFail2banJails",
  "LinuxPermissionFindings",
  "LinuxSudoNopasswdEntries",
  "Devices",
];

async function main() {
  const db = await getDb();

  console.log("=== Row counts (sys.dm_db_partition_stats, fast) ===");
  const counts = await db.query(`
    SELECT t.name AS TableName, SUM(p.rows) AS Rows
    FROM sys.tables t
    JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0,1)
    WHERE t.name IN ('${TABLES.join("','")}')
    GROUP BY t.name
    ORDER BY Rows DESC
  `);
  console.table(counts.recordset);

  console.log("\n=== Indexes on each table ===");
  for (const tbl of TABLES) {
    const idx = await db.query(`
      SELECT i.name AS IndexName, i.type_desc, STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS Columns
      FROM sys.indexes i
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.object_id = OBJECT_ID('${tbl}') AND i.name IS NOT NULL
      GROUP BY i.name, i.type_desc
    `);
    console.log(`--- ${tbl} ---`);
    console.table(idx.recordset);
  }

  console.log("\n=== Sample device for timing test ===");
  const sampleDevice = await db.query(
    "SELECT TOP 1 DeviceId FROM Devices WHERE DeviceType = 'Server' ORDER BY EnrolledAt DESC"
  );
  const deviceId = sampleDevice.recordset[0]?.DeviceId;
  console.log("deviceId:", deviceId);

  if (deviceId) {
    const t0 = Date.now();
    await db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT COUNT(*) AS Cnt FROM ServerLogEntries WHERE DeviceId = @deviceId");
    console.log("ServerLogEntries COUNT(*) ms:", Date.now() - t0);

    const t1 = Date.now();
    await db.request().input("deviceId", sql.VarChar, deviceId).query(
      "SELECT COUNT(*) AS Total FROM ServerLogEntries WHERE DeviceId = @deviceId AND LogSource IN ('mssql', 'mssql_slow')"
    );
    console.log("mssqlLogCount ms:", Date.now() - t1);

    const t2 = Date.now();
    await db.request().input("deviceId", sql.VarChar, deviceId).query(`
      SELECT TOP 10 Id, ReceivedAt, LogSource, Severity, Message
      FROM ServerLogEntries WHERE DeviceId = @deviceId AND LogSource IN ('eventlog', 'system', 'reboot')
      ORDER BY ReceivedAt DESC
    `);
    console.log("recentHealthLogs ms:", Date.now() - t2);

    const t3 = Date.now();
    await db.request().input("deviceId", sql.VarChar, deviceId).query(`
      SELECT TOP 1 CpuPct, MemPct, DiskPct, DiskLatencyMs, NetRxMbps, NetTxMbps, UptimeSeconds, ReceivedAt
      FROM DeviceMetrics WHERE DeviceId = @deviceId ORDER BY ReceivedAt DESC
    `);
    console.log("metrics ms:", Date.now() - t3);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
