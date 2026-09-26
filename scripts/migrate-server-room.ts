import "dotenv/config";
import { getDb } from "../src/lib/db";

// Server Room Entry + technical/hosting/security tasks + Security Incident IDs + operations audit log.
// Fully idempotent - safe to re-run. Creates new tables only; nothing existing is altered.

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
  // Per-year counter behind INC-YYYY-NNNNNN. Incremented under UPDLOCK/HOLDLOCK so two people creating an
  // incident at the same moment can never receive the same number.
  await createTableIfMissing(
    "IncidentCounters",
    `CREATE TABLE IncidentCounters (
      CounterYear INT NOT NULL PRIMARY KEY,
      LastNumber INT NOT NULL
    )`
  );

  // One row per physical visit to the server room. EntryAt / ExitAt are always set by the server clock.
  await createTableIfMissing(
    "ServerRoomEntries",
    `CREATE TABLE ServerRoomEntries (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      StaffId INT NULL,
      StaffName NVARCHAR(200) NOT NULL,
      EntryAt DATETIME2 NOT NULL CONSTRAINT DF_ServerRoomEntries_EntryAt DEFAULT SYSUTCDATETIME(),
      ExitAt DATETIME2 NULL,
      ReasonCategory VARCHAR(40) NOT NULL,
      WorkPerformed NVARCHAR(2000) NULL,
      IncidentNumber VARCHAR(20) NULL,
      RecordedByUserId INT NULL,
      RecordedByName NVARCHAR(100) NULL,
      ExitRecordedByName NVARCHAR(100) NULL,
      CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ServerRoomEntries_CreatedAt DEFAULT SYSUTCDATETIME()
    )`
  );
  await createIndexIfMissing("IX_ServerRoomEntries_EntryAt", "ServerRoomEntries", "EntryAt DESC");
  await createIndexIfMissing("IX_ServerRoomEntries_Active", "ServerRoomEntries", "ExitAt, EntryAt DESC");

  // Technical support / website hosting / security update work, optionally tied to a server-room entry.
  // TaskGroup: 'Technical Support' | 'Website Hosting' | 'Security Update'. Status: In Progress | Completed | Blocked | Cancelled.
  await createTableIfMissing(
    "ServerRoomTasks",
    `CREATE TABLE ServerRoomTasks (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      EntryId INT NULL,
      StaffId INT NULL,
      StaffName NVARCHAR(200) NOT NULL,
      TaskGroup VARCHAR(30) NOT NULL,
      TaskType NVARCHAR(80) NOT NULL,
      DeviceId VARCHAR(36) NULL,
      DeviceLabel NVARCHAR(200) NULL,
      Description NVARCHAR(2000) NOT NULL,
      StartAt DATETIME2 NOT NULL CONSTRAINT DF_ServerRoomTasks_StartAt DEFAULT SYSUTCDATETIME(),
      EndAt DATETIME2 NULL,
      Status VARCHAR(20) NOT NULL CONSTRAINT DF_ServerRoomTasks_Status DEFAULT 'In Progress',
      IncidentNumber VARCHAR(20) NULL,
      RecordedByUserId INT NULL,
      RecordedByName NVARCHAR(100) NULL,
      CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ServerRoomTasks_CreatedAt DEFAULT SYSUTCDATETIME()
    )`
  );
  await createIndexIfMissing("IX_ServerRoomTasks_Start", "ServerRoomTasks", "StartAt DESC");
  await createIndexIfMissing("IX_ServerRoomTasks_Group", "ServerRoomTasks", "TaskGroup, Status, StartAt DESC");
  await createIndexIfMissing("IX_ServerRoomTasks_Entry", "ServerRoomTasks", "EntryId");

  // Security incidents (named SecurityIncidents - the existing "Incidents" table belongs to Website/API Monitoring).
  await createTableIfMissing(
    "SecurityIncidents",
    `CREATE TABLE SecurityIncidents (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      IncidentNumber VARCHAR(20) NOT NULL,
      Title NVARCHAR(300) NOT NULL,
      Severity VARCHAR(12) NOT NULL CONSTRAINT DF_SecurityIncidents_Severity DEFAULT 'medium',
      Status VARCHAR(20) NOT NULL CONSTRAINT DF_SecurityIncidents_Status DEFAULT 'Open',
      DeviceId VARCHAR(36) NULL,
      DeviceLabel NVARCHAR(200) NULL,
      Description NVARCHAR(2000) NULL,
      Resolution NVARCHAR(2000) NULL,
      CreatedByUserId INT NULL,
      CreatedByName NVARCHAR(100) NULL,
      CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_SecurityIncidents_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_SecurityIncidents_UpdatedAt DEFAULT SYSUTCDATETIME(),
      ResolvedAt DATETIME2 NULL
    )`
  );
  await createIndexIfMissing("UX_SecurityIncidents_Number", "SecurityIncidents", "IncidentNumber", true);
  await createIndexIfMissing("IX_SecurityIncidents_Status", "SecurityIncidents", "Status, CreatedAt DESC");

  // The chain device -> finding -> update -> staff -> task -> action -> resolution, one row per step.
  await createTableIfMissing(
    "IncidentTimeline",
    `CREATE TABLE IncidentTimeline (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      IncidentId INT NOT NULL,
      StepType VARCHAR(20) NOT NULL,
      Summary NVARCHAR(1000) NOT NULL,
      DeviceId VARCHAR(36) NULL,
      DeviceLabel NVARCHAR(200) NULL,
      UpdateKey NVARCHAR(300) NULL,
      EntryId INT NULL,
      TaskId INT NULL,
      StaffName NVARCHAR(200) NULL,
      ActorName NVARCHAR(100) NULL,
      CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_IncidentTimeline_CreatedAt DEFAULT SYSUTCDATETIME()
    )`
  );
  await createIndexIfMissing("IX_IncidentTimeline_Incident", "IncidentTimeline", "IncidentId, CreatedAt");

  // Operations audit trail for everything this module does (update scans/installs are read from UpdateHistory
  // and merged in by the audit query).
  await createTableIfMissing(
    "OpsAuditLog",
    `CREATE TABLE OpsAuditLog (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      EventType VARCHAR(40) NOT NULL,
      StaffName NVARCHAR(200) NULL,
      ActorName NVARCHAR(100) NULL,
      DeviceId VARCHAR(36) NULL,
      DeviceLabel NVARCHAR(200) NULL,
      OS VARCHAR(20) NULL,
      TaskType NVARCHAR(80) NULL,
      IncidentNumber VARCHAR(20) NULL,
      Detail NVARCHAR(1000) NULL,
      StartedAt DATETIME2 NULL,
      CompletedAt DATETIME2 NULL,
      CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_OpsAuditLog_CreatedAt DEFAULT SYSUTCDATETIME()
    )`
  );
  await createIndexIfMissing("IX_OpsAuditLog_CreatedAt", "OpsAuditLog", "CreatedAt DESC");
  await createIndexIfMissing("IX_OpsAuditLog_Incident", "OpsAuditLog", "IncidentNumber");

  console.log("Server Room migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
