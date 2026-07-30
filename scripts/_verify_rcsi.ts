import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

async function main() {
  const db = await getDb();

  const rcsi = await db.query(`
    SELECT name, is_read_committed_snapshot_on FROM sys.databases WHERE database_id = DB_ID()
  `);
  console.log("RCSI status:", JSON.stringify(rcsi.recordset[0]));

  const devices = await db.query<{ DeviceId: string; DeviceName: string | null }>(
    "SELECT DeviceId, DeviceName FROM Devices WHERE DeviceName LIKE '%WordPres%' OR DeviceName LIKE '%GitLab%' OR DeviceName LIKE '%Laravel%'"
  );

  for (const device of devices.recordset) {
    const deviceId = device.DeviceId;
    const t0 = Date.now();
    await Promise.all([
      db.request().input("deviceId", sql.VarChar, deviceId).query(`SELECT CpuModel FROM DeviceHardwareInfo WHERE DeviceId = @deviceId`),
      db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT DiskIndex FROM DeviceDisks WHERE DeviceId = @deviceId ORDER BY DiskIndex ASC"),
      db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT InterfaceName FROM DeviceNetworkInterfaces WHERE DeviceId = @deviceId"),
      db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT COUNT(*) AS Cnt FROM ServerLogEntries WHERE DeviceId = @deviceId"),
      db.request().input("deviceId", sql.VarChar, deviceId).query(`SELECT TOP 1 CpuPct FROM DeviceMetrics WHERE DeviceId = @deviceId ORDER BY ReceivedAt DESC`),
      db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT ServicesJson FROM DeviceServiceSnapshot WHERE DeviceId = @deviceId"),
      db.request().input("deviceId", sql.VarChar, deviceId).query(`SELECT TOP 10 Id FROM ServerLogEntries WHERE DeviceId = @deviceId AND LogSource IN ('eventlog', 'system', 'reboot') ORDER BY ReceivedAt DESC`),
      db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT Name FROM IisAppPools WHERE DeviceId = @deviceId ORDER BY Name ASC"),
      db.request().input("deviceId", sql.VarChar, deviceId).query(`SELECT SiteName FROM IisSites WHERE DeviceId = @deviceId ORDER BY SiteName ASC`),
      db.request().input("deviceId", sql.VarChar, deviceId).query(`SELECT ProcessId FROM IisWorkerProcesses WHERE DeviceId = @deviceId ORDER BY PrivateBytesMB DESC`),
      db.request().input("deviceId", sql.VarChar, deviceId).query(`SELECT TOP 1 WebServiceRequestsPerSec FROM IisPerfSnapshots WHERE DeviceId = @deviceId ORDER BY ReceivedAt DESC`),
      db.request().input("deviceId", sql.VarChar, deviceId).query(`SELECT SshPort FROM LinuxSecurityStatus WHERE DeviceId = @deviceId`),
      db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT Protocol FROM LinuxOpenPorts WHERE DeviceId = @deviceId ORDER BY Port ASC"),
      db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT JailName FROM LinuxFail2banJails WHERE DeviceId = @deviceId ORDER BY JailName ASC"),
      db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT IssueType FROM LinuxPermissionFindings WHERE DeviceId = @deviceId ORDER BY IssueType ASC"),
      db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT Entry FROM LinuxSudoNopasswdEntries WHERE DeviceId = @deviceId ORDER BY Entry ASC"),
      db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT MountPoint FROM DeviceVolumes WHERE DeviceId = @deviceId ORDER BY MountPoint ASC"),
      db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT COUNT(*) AS Total FROM ServerLogEntries WHERE DeviceId = @deviceId AND LogSource IN ('mssql', 'mssql_slow')"),
    ]);
    console.log(`${device.DeviceName} | Promise.all wall ms: ${Date.now() - t0}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
