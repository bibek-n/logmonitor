import "dotenv/config";
import { getDb } from "../src/lib/db";

// Security & Updates (Phase 1): per-device update scans reported by the endpoint agent, the current
// list of pending/failed updates per device, an event history, and the queue of admin-requested scans.
// Fully idempotent - safe to re-run. Nothing here touches existing tables.

async function createTableIfMissing(name: string, ddl: string) {
  const db = await getDb();
  const exists = await db.query(`SELECT 1 FROM sysobjects WHERE name = '${name}' AND xtype = 'U'`);
  if (exists.recordset.length > 0) {
    console.log(`${name} already exists - skipping`);
    return;
  }
  await db.query(ddl);
  console.log(`Created ${name}`);
}

async function createIndexIfMissing(name: string, table: string, columns: string, unique = false) {
  const db = await getDb();
  const exists = await db.query(`SELECT 1 FROM sys.indexes WHERE name = '${name}'`);
  if (exists.recordset.length > 0) {
    console.log(`Index ${name} already exists - skipping`);
    return;
  }
  await db.query(`CREATE ${unique ? "UNIQUE " : ""}INDEX ${name} ON ${table} (${columns})`);
  console.log(`Created index ${name}`);
}

async function main() {
  // One row per completed scan (summary counts only - the individual updates live in DeviceUpdates).
  await createTableIfMissing(
    "DeviceUpdateScans",
    `CREATE TABLE DeviceUpdateScans (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      ScannedAt DATETIME2 NOT NULL CONSTRAINT DF_DeviceUpdateScans_ScannedAt DEFAULT SYSUTCDATETIME(),
      TriggerType VARCHAR(20) NOT NULL,
      Family VARCHAR(30) NULL,
      Supported BIT NOT NULL,
      Complete BIT NOT NULL,
      RebootRequired BIT NOT NULL,
      PendingCount INT NOT NULL,
      SecurityCount INT NOT NULL,
      CriticalCount INT NOT NULL,
      KernelCount INT NOT NULL,
      FirmwareCount INT NOT NULL,
      DriverCount INT NOT NULL,
      ApplicationCount INT NOT NULL,
      PackageCount INT NOT NULL,
      FailedCount INT NOT NULL,
      LastInstalledAt VARCHAR(40) NULL,
      DefinitionsName NVARCHAR(100) NULL,
      DefinitionsVersion NVARCHAR(100) NULL,
      DefinitionsAgeDays INT NULL,
      WarningsJson NVARCHAR(MAX) NULL
    )`
  );
  await createIndexIfMissing("IX_DeviceUpdateScans_Device", "DeviceUpdateScans", "DeviceId, ScannedAt DESC");

  // Current per-device update list. Status: Pending | Failed | Installed | Deferred.
  await createTableIfMissing(
    "DeviceUpdates",
    `CREATE TABLE DeviceUpdates (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      UpdateKey NVARCHAR(300) NOT NULL,
      Title NVARCHAR(500) NOT NULL,
      Category VARCHAR(20) NOT NULL,
      Severity VARCHAR(12) NOT NULL CONSTRAINT DF_DeviceUpdates_Severity DEFAULT 'none',
      CurrentVersion NVARCHAR(100) NULL,
      NewVersion NVARCHAR(100) NULL,
      SizeMB DECIMAL(10,1) NULL,
      RequiresReboot BIT NOT NULL CONSTRAINT DF_DeviceUpdates_RequiresReboot DEFAULT 0,
      IsDisruptive BIT NOT NULL CONSTRAINT DF_DeviceUpdates_IsDisruptive DEFAULT 0,
      Status VARCHAR(12) NOT NULL,
      FailureMessage NVARCHAR(1000) NULL,
      FirstSeenAt DATETIME2 NOT NULL CONSTRAINT DF_DeviceUpdates_FirstSeenAt DEFAULT SYSUTCDATETIME(),
      LastSeenAt DATETIME2 NOT NULL CONSTRAINT DF_DeviceUpdates_LastSeenAt DEFAULT SYSUTCDATETIME(),
      InstalledAt DATETIME2 NULL,
      IncidentNumber VARCHAR(20) NULL
    )`
  );
  await createIndexIfMissing("UX_DeviceUpdates_DeviceKey", "DeviceUpdates", "DeviceId, UpdateKey", true);
  await createIndexIfMissing("IX_DeviceUpdates_Status", "DeviceUpdates", "Status, Category");

  // Event history (scan, update found, failed, installed, reboot required, scan requested...). Denormalised
  // Hostname/OS so history stays readable and filterable even if a device is later renamed or removed.
  await createTableIfMissing(
    "UpdateHistory",
    `CREATE TABLE UpdateHistory (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NULL,
      Hostname NVARCHAR(200) NULL,
      OS VARCHAR(20) NULL,
      EventType VARCHAR(30) NOT NULL,
      UpdateKey NVARCHAR(300) NULL,
      Title NVARCHAR(500) NULL,
      Category VARCHAR(20) NULL,
      Detail NVARCHAR(1000) NULL,
      ActorUserId INT NULL,
      ActorName NVARCHAR(100) NULL,
      RequestId INT NULL,
      IncidentNumber VARCHAR(20) NULL,
      CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_UpdateHistory_CreatedAt DEFAULT SYSUTCDATETIME()
    )`
  );
  await createIndexIfMissing("IX_UpdateHistory_CreatedAt", "UpdateHistory", "CreatedAt DESC");
  await createIndexIfMissing("IX_UpdateHistory_Device", "UpdateHistory", "DeviceId, CreatedAt DESC");
  await createIndexIfMissing("IX_UpdateHistory_Event", "UpdateHistory", "EventType, CreatedAt DESC");

  // Admin-queued jobs picked up by the agent through the heartbeat (Kind 'scan' in Phase 1).
  await createTableIfMissing(
    "PendingUpdateRequests",
    `CREATE TABLE PendingUpdateRequests (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      Kind VARCHAR(20) NOT NULL,
      PayloadJson NVARCHAR(MAX) NULL,
      AllowDisruptive BIT NOT NULL CONSTRAINT DF_PendingUpdateRequests_AllowDisruptive DEFAULT 0,
      RequestedByUserId INT NULL,
      RequestedByName NVARCHAR(100) NULL,
      ConfirmedByUserId INT NULL,
      ScheduledFor DATETIME2 NULL,
      CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_PendingUpdateRequests_CreatedAt DEFAULT SYSUTCDATETIME(),
      ExpiresAt DATETIME2 NOT NULL,
      FulfilledAt DATETIME2 NULL,
      ResultStatus VARCHAR(20) NULL
    )`
  );
  await createIndexIfMissing("IX_PendingUpdateRequests_Device", "PendingUpdateRequests", "DeviceId, FulfilledAt");

  console.log("Security & Updates migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
