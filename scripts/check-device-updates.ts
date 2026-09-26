import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

// Read-only: show the latest Security & Updates scan, the pending updates and recent install requests for the devices
// matching <text> (hostname / name / staff). Usage: tsx scripts/check-device-updates.ts <text>
async function main() {
  const text = process.argv[2]?.trim();
  if (!text) {
    console.error("usage: check-device-updates.ts <text>");
    process.exit(2);
  }
  const db = await getDb();
  const devs = await db
    .request()
    .input("q", sql.NVarChar, `%${text}%`)
    .query<{ DeviceId: string; Hostname: string; AgentVersion: string | null; HbAge: number | null }>(
      `SELECT d.DeviceId, d.Hostname, d.AgentVersion, DATEDIFF(SECOND, d.LastHeartbeat, SYSUTCDATETIME()) AS HbAge
       FROM Devices d LEFT JOIN Staff st ON st.Id = d.StaffId WHERE d.Hostname LIKE @q OR d.DeviceName LIKE @q OR st.Name LIKE @q`
    );
  for (const d of devs.recordset) {
    console.log(`\n=== ${d.Hostname}  agent=${d.AgentVersion}  lastSeen=${d.HbAge}s  id=${d.DeviceId}`);
    const scan = await db
      .request()
      .input("d", sql.VarChar, d.DeviceId)
      .query("SELECT TOP 1 CONVERT(VARCHAR(19), ScannedAt, 126) AS ScannedAt, TriggerType, Family, Supported, Complete, RebootRequired, PendingCount, SecurityCount, CriticalCount, KernelCount, FirmwareCount, DriverCount, ApplicationCount, PackageCount, FailedCount, DefinitionsName, DefinitionsVersion, DefinitionsAgeDays, WarningsJson FROM DeviceUpdateScans WHERE DeviceId = @d ORDER BY ScannedAt DESC");
    console.log("latest scan:", JSON.stringify(scan.recordset[0] ?? "NONE YET"));
    const ups = await db
      .request()
      .input("d", sql.VarChar, d.DeviceId)
      .query("SELECT UpdateKey, Title, Category, Severity, RequiresReboot, IsDisruptive, Status, SizeMB FROM DeviceUpdates WHERE DeviceId = @d AND Status IN ('Pending','Failed') ORDER BY IsDisruptive, Category, Title");
    for (const u of ups.recordset) {
      console.log(`  [${u.Status}] ${u.IsDisruptive ? "DISRUPTIVE" : "safe      "} ${String(u.Category).padEnd(11)} ${String(u.Severity).padEnd(8)} reboot=${u.RequiresReboot ? "Y" : "n"} size=${u.SizeMB ?? "-"}MB  ${u.Title}  key=${u.UpdateKey}`);
    }
    const reqs = await db
      .request()
      .input("d", sql.VarChar, d.DeviceId)
      .query("SELECT TOP 5 Id, Kind, ResultStatus, RequestedByName, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt, CONVERT(VARCHAR(19), StartedAt, 126) AS StartedAt, CONVERT(VARCHAR(19), FulfilledAt, 126) AS FulfilledAt, ResultSummary FROM PendingUpdateRequests WHERE DeviceId = @d ORDER BY Id DESC");
    for (const r of reqs.recordset) console.log("  request:", JSON.stringify(r));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
