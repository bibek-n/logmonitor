import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

async function timeQuery(db: any, deviceId: string, label: string, query: string) {
  const t0 = Date.now();
  const r = await db.request().input("deviceId", sql.VarChar, deviceId).query(query);
  console.log(`${label}: ${Date.now() - t0}ms (rows: ${r.recordset.length})`);
}

async function main() {
  const db = await getDb();
  const target = await db.query<{ DeviceId: string; DeviceName: string }>(
    "SELECT DeviceId, DeviceName FROM Devices WHERE DeviceName LIKE '%WordPres-DevServer%' OR DeviceName LIKE '%WordPress-DevServer%'"
  );
  const deviceId = target.recordset[0]?.DeviceId;
  console.log("Target device:", target.recordset[0]?.DeviceName, deviceId);
  if (!deviceId) {
    console.log("not found, listing all:");
    const all = await db.query("SELECT DeviceId, DeviceName FROM Devices WHERE DeviceType='Server'");
    console.table(all.recordset);
    process.exit(1);
  }

  await timeQuery(db, deviceId, "hardware", "SELECT CpuModel FROM DeviceHardwareInfo WHERE DeviceId = @deviceId");
  await timeQuery(db, deviceId, "disks", "SELECT DiskIndex FROM DeviceDisks WHERE DeviceId = @deviceId ORDER BY DiskIndex ASC");
  await timeQuery(db, deviceId, "interfaces", "SELECT InterfaceName FROM DeviceNetworkInterfaces WHERE DeviceId = @deviceId");
  await timeQuery(db, deviceId, "logCount", "SELECT COUNT(*) AS Cnt FROM ServerLogEntries WHERE DeviceId = @deviceId");
  await timeQuery(db, deviceId, "metrics", "SELECT TOP 1 CpuPct FROM DeviceMetrics WHERE DeviceId = @deviceId ORDER BY ReceivedAt DESC");
  await timeQuery(db, deviceId, "serviceSnapshot", "SELECT ServicesJson FROM DeviceServiceSnapshot WHERE DeviceId = @deviceId");
  await timeQuery(db, deviceId, "recentHealthLogs", "SELECT TOP 10 Id FROM ServerLogEntries WHERE DeviceId = @deviceId AND LogSource IN ('eventlog', 'system', 'reboot') ORDER BY ReceivedAt DESC");
  await timeQuery(db, deviceId, "iisAppPools", "SELECT Name FROM IisAppPools WHERE DeviceId = @deviceId ORDER BY Name ASC");
  await timeQuery(db, deviceId, "iisSites", "SELECT SiteName FROM IisSites WHERE DeviceId = @deviceId ORDER BY SiteName ASC");
  await timeQuery(db, deviceId, "iisWorkers", "SELECT ProcessId FROM IisWorkerProcesses WHERE DeviceId = @deviceId ORDER BY PrivateBytesMB DESC");
  await timeQuery(db, deviceId, "iisPerf", "SELECT TOP 1 WebServiceRequestsPerSec FROM IisPerfSnapshots WHERE DeviceId = @deviceId ORDER BY ReceivedAt DESC");
  await timeQuery(db, deviceId, "linuxSecurity", "SELECT SshPort FROM LinuxSecurityStatus WHERE DeviceId = @deviceId");
  await timeQuery(db, deviceId, "linuxPorts", "SELECT Protocol FROM LinuxOpenPorts WHERE DeviceId = @deviceId ORDER BY Port ASC");
  await timeQuery(db, deviceId, "fail2ban", "SELECT JailName FROM LinuxFail2banJails WHERE DeviceId = @deviceId ORDER BY JailName ASC");
  await timeQuery(db, deviceId, "permFindings", "SELECT IssueType FROM LinuxPermissionFindings WHERE DeviceId = @deviceId ORDER BY IssueType ASC");
  await timeQuery(db, deviceId, "sudoEntries", "SELECT Entry FROM LinuxSudoNopasswdEntries WHERE DeviceId = @deviceId ORDER BY Entry ASC");
  await timeQuery(db, deviceId, "volumes", "SELECT MountPoint FROM DeviceVolumes WHERE DeviceId = @deviceId ORDER BY MountPoint ASC");
  await timeQuery(db, deviceId, "mssqlLogCount", "SELECT COUNT(*) AS Total FROM ServerLogEntries WHERE DeviceId = @deviceId AND LogSource IN ('mssql', 'mssql_slow')");

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
