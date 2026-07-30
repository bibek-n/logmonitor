import "dotenv/config";
import { getDb } from "../src/lib/db";

// Automation module: Scripts, on-demand Remote Tasks (AutomationJobs/AutomationJobTargets),
// and recurring Scheduled Jobs (AutomationSchedules/AutomationScheduleTargets).
//
// Reuses the exact same "request now, agent picks it up on next heartbeat" delivery mechanism
// as PendingMalwareScanRequests/PendingPhpLogRequests (see migrate-malware-detection-ondemand.ts) -
// but unlike malware-scan's bare boolean flag, this needs a real per-request identity (a job can
// target many devices, each with its own independent result), so AutomationJobTargets IS the
// pending-request queue itself (Status='Pending' rows are exactly the pending work) rather than
// a separate table - the PhpLogRequest precedent for "parameterized, not just a boolean" already
// established that pattern, this just goes one step further and gives each request a stable
// database identity (AutomationJobTargets.Id) the agent's report-back POST references directly,
// instead of the malware-scan route's coarse "mark ANY unfulfilled request done" approach.
//
// The script body actually executed is snapshotted onto AutomationJobs at creation time (not
// re-read from AutomationScripts when the agent picks it up) so editing/deleting a Script later
// never changes what an already-queued or historical job ran - the audit trail always reflects
// exactly what was sent to a real, credentialed, SYSTEM/root-level agent process.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AutomationScripts' AND xtype='U')
    CREATE TABLE AutomationScripts (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      Description NVARCHAR(1000) NULL,
      PowerShellBody NVARCHAR(MAX) NULL,
      BashBody NVARCHAR(MAX) NULL,
      TimeoutSeconds INT NOT NULL DEFAULT 300,
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      IsDeleted BIT NOT NULL DEFAULT 0,
      CONSTRAINT CK_AutomationScripts_HasBody CHECK (PowerShellBody IS NOT NULL OR BashBody IS NOT NULL)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AutomationJobs' AND xtype='U')
    CREATE TABLE AutomationJobs (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ScriptId INT NULL REFERENCES AutomationScripts(Id),
      ScriptNameSnapshot NVARCHAR(200) NOT NULL,
      PowerShellBodySnapshot NVARCHAR(MAX) NULL,
      BashBodySnapshot NVARCHAR(MAX) NULL,
      TimeoutSeconds INT NOT NULL DEFAULT 300,
      TriggerType VARCHAR(20) NOT NULL DEFAULT 'Manual',
      ScheduleId INT NULL,
      RequestedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_AutomationJobs_TriggerType CHECK (TriggerType IN ('Manual','Scheduled'))
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AutomationJobTargets' AND xtype='U')
    CREATE TABLE AutomationJobTargets (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      JobId INT NOT NULL REFERENCES AutomationJobs(Id) ON DELETE CASCADE,
      DeviceId VARCHAR(36) NOT NULL REFERENCES Devices(DeviceId),
      Status VARCHAR(20) NOT NULL DEFAULT 'Pending',
      ExitCode INT NULL,
      Stdout NVARCHAR(MAX) NULL,
      Stderr NVARCHAR(MAX) NULL,
      ErrorMessage NVARCHAR(1000) NULL,
      StartedAt DATETIME2 NULL,
      CompletedAt DATETIME2 NULL,
      CONSTRAINT CK_AutomationJobTargets_Status CHECK (Status IN ('Pending','Running','Success','Failed','TimedOut','Error'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_AutomationJobTargets_JobId')
    CREATE INDEX IX_AutomationJobTargets_JobId ON AutomationJobTargets (JobId)
  `;
  // The queue-lookup index the heartbeat route actually uses - mirrors
  // IX_PendingMalwareScanRequests_DeviceId_Unfulfilled's filtered-index shape exactly.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_AutomationJobTargets_DeviceId_Pending')
    CREATE INDEX IX_AutomationJobTargets_DeviceId_Pending ON AutomationJobTargets (DeviceId) WHERE Status = 'Pending'
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AutomationSchedules' AND xtype='U')
    CREATE TABLE AutomationSchedules (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ScriptId INT NOT NULL REFERENCES AutomationScripts(Id),
      Name NVARCHAR(200) NOT NULL,
      IntervalMinutes INT NOT NULL,
      NextRunAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      LastRunAt DATETIME2 NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      IsDeleted BIT NOT NULL DEFAULT 0,
      CONSTRAINT CK_AutomationSchedules_Interval CHECK (IntervalMinutes >= 1)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AutomationScheduleTargets' AND xtype='U')
    CREATE TABLE AutomationScheduleTargets (
      AutomationScheduleId INT NOT NULL REFERENCES AutomationSchedules(Id) ON DELETE CASCADE,
      DeviceId VARCHAR(36) NOT NULL REFERENCES Devices(DeviceId),
      PRIMARY KEY (AutomationScheduleId, DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_AutomationSchedules_Due')
    CREATE INDEX IX_AutomationSchedules_Due ON AutomationSchedules (NextRunAt) WHERE IsActive = 1 AND IsDeleted = 0
  `;

  console.log("Automation module schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
