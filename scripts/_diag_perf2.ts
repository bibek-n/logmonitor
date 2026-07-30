import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

async function main() {
  const db = await getDb();

  const devices = await db.query<{ DeviceId: string; DeviceName: string | null }>(
    "SELECT DeviceId, DeviceName FROM Devices WHERE DeviceType = 'Server'"
  );

  for (const device of devices.recordset) {
    const deviceId = device.DeviceId;
    const t0 = Date.now();
    const results = await Promise.all([
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
    const elapsed = Date.now() - t0;
    const servicesJson = results[5].recordset[0]?.ServicesJson as string | undefined;
    const servicesJsonKB = servicesJson ? (servicesJson.length / 1024).toFixed(1) : "0";
    const iisSiteCount = results[8].recordset.length;
    const iisWorkerCount = results[9].recordset.length;
    console.log(
      `${device.DeviceName ?? deviceId} | Promise.all wall ms: ${elapsed} | ServicesJson KB: ${servicesJsonKB} | IisSites: ${iisSiteCount} | IisWorkers: ${iisWorkerCount}`
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
