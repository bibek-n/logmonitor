import "dotenv/config";
import { getDb } from "../src/lib/db";

// Per-volume/drive disk capacity - DeviceMetrics.DiskPct/DiskFreeGB/DiskTotalGB already
// existed but only ever tracked whichever single partition happened to be fullest at that
// moment (see agent/metrics.go's CollectMetrics), with no record of which drive/mount that
// was. This table instead keeps one row per currently-mounted volume (every Windows drive
// letter, every Linux mount point) - latest-snapshot-per-device (delete-then-insert on every
// /api/agent/metrics upload, same cadence as the existing DiskPct scalar), same pattern as
// DeviceDisks (physical disks) and IisAppPools. Shared by both Servers and Endpoint Agents -
// both device categories are rows in the same Devices table and post through the same agent
// binary/endpoint (see linuxsecurity.go's session's own DeviceType research), so one table
// covers Windows servers, Linux servers, Windows PCs, and Linux PCs alike.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DeviceVolumes' AND xtype='U')
    CREATE TABLE DeviceVolumes (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      MountPoint NVARCHAR(260) NOT NULL,
      Device NVARCHAR(260) NULL,
      FsType VARCHAR(32) NULL,
      TotalGB FLOAT NULL,
      FreeGB FLOAT NULL,
      UsedPercent FLOAT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_DeviceVolumes_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_DeviceVolumes_DeviceId')
    CREATE INDEX IX_DeviceVolumes_DeviceId ON DeviceVolumes (DeviceId)
  `;

  console.log("DeviceVolumes schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
