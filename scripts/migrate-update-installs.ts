import "dotenv/config";
import { getDb } from "../src/lib/db";

// Security & Updates Phase 3: approved installs and scheduled updates. Idempotent; only adds columns/tables.

async function addColumnIfMissing(table: string, column: string, type: string) {
  const db = await getDb();
  const exists = await db.query(`SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}'`);
  if (exists.recordset.length > 0) {
    console.log(`${table}.${column} already exists - skipping`);
    return;
  }
  await db.query(`ALTER TABLE ${table} ADD ${column} ${type}`);
  console.log(`Added ${table}.${column}`);
}

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

async function createIndexIfMissing(name: string, table: string, columns: string) {
  const db = await getDb();
  const exists = await db.query(`SELECT 1 FROM sys.indexes WHERE name = '${name}'`);
  if (exists.recordset.length > 0) {
    console.log(`Index ${name} already exists - skipping`);
    return;
  }
  await db.query(`CREATE INDEX ${name} ON ${table} (${columns})`);
  console.log(`Created index ${name}`);
}

async function main() {
  // Install requests reuse PendingUpdateRequests (Kind 'install'). StartedAt is set when the agent reports "running" -
  // from then on the request is never sent to the agent again (at-most-once execution).
  await addColumnIfMissing("PendingUpdateRequests", "StartedAt", "DATETIME2 NULL");
  await addColumnIfMissing("PendingUpdateRequests", "ResultSummary", "NVARCHAR(1000) NULL");
  await addColumnIfMissing("PendingUpdateRequests", "RebootRequired", "BIT NULL");
  await addColumnIfMissing("PendingUpdateRequests", "ConfirmedByName", "NVARCHAR(100) NULL");
  await addColumnIfMissing("PendingUpdateRequests", "ScheduleId", "INT NULL");
  await createIndexIfMissing("IX_PendingUpdateRequests_Kind", "PendingUpdateRequests", "Kind, DeviceId, FulfilledAt");

  // Per-update outcome of an install request.
  await createTableIfMissing(
    "UpdateInstallResults",
    `CREATE TABLE UpdateInstallResults (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      RequestId INT NOT NULL,
      DeviceId VARCHAR(36) NOT NULL,
      UpdateKey NVARCHAR(300) NOT NULL,
      Title NVARCHAR(500) NULL,
      Outcome VARCHAR(12) NOT NULL,
      Message NVARCHAR(1000) NULL,
      CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_UpdateInstallResults_CreatedAt DEFAULT SYSUTCDATETIME()
    )`
  );
  await createIndexIfMissing("IX_UpdateInstallResults_Request", "UpdateInstallResults", "RequestId");

  // Scheduled updates. NextRunAt is UTC. Recurrence: 'once' (deactivates after running) or 'weekly'.
  // IncludeDisruptive is only ever set together with a recorded administrator confirmation (ConfirmedBy*).
  await createTableIfMissing(
    "UpdateSchedules",
    `CREATE TABLE UpdateSchedules (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      Recurrence VARCHAR(10) NOT NULL,
      NextRunAt DATETIME2 NULL,
      Categories NVARCHAR(200) NOT NULL,
      IncludeDisruptive BIT NOT NULL CONSTRAINT DF_UpdateSchedules_IncludeDisruptive DEFAULT 0,
      ConfirmedByUserId INT NULL,
      ConfirmedByName NVARCHAR(100) NULL,
      ConfirmedAt DATETIME2 NULL,
      IsActive BIT NOT NULL CONSTRAINT DF_UpdateSchedules_IsActive DEFAULT 1,
      IsDeleted BIT NOT NULL CONSTRAINT DF_UpdateSchedules_IsDeleted DEFAULT 0,
      LastRunAt DATETIME2 NULL,
      LastRunSummary NVARCHAR(500) NULL,
      CreatedByUserId INT NULL,
      CreatedByName NVARCHAR(100) NULL,
      CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_UpdateSchedules_CreatedAt DEFAULT SYSUTCDATETIME()
    )`
  );
  await createIndexIfMissing("IX_UpdateSchedules_Due", "UpdateSchedules", "IsActive, IsDeleted, NextRunAt");
  await createTableIfMissing(
    "UpdateScheduleTargets",
    `CREATE TABLE UpdateScheduleTargets (
      ScheduleId INT NOT NULL,
      DeviceId VARCHAR(36) NOT NULL,
      CONSTRAINT PK_UpdateScheduleTargets PRIMARY KEY (ScheduleId, DeviceId)
    )`
  );

  console.log("Update installs / schedules migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
