import "dotenv/config";
import { getDb } from "../src/lib/db";

// Remote Access Phase 2: certificate trust tracking (RDP/HTTPS - "never automatically trust an
// invalid or changed certificate"), SSH port forwarding/jump-host session tracking, the saved
// Scripts & Commands library + its execution history (BatchId groups a bulk run across multiple
// connections into one logical execution), and SCTP connectivity-diagnostics results. These were
// deliberately deferred from the Phase 1 migration (see migrate-remote-access.ts's header
// comment) - this file adds exactly the 5 tables that were named there as Phase 2.
async function main() {
  const db = await getDb();

  // Every fingerprint this app has ever seen for a given target is recorded (not just the
  // latest) so a changed fingerprint can be detected and flagged as untrusted-by-default,
  // per "never automatically trust an invalid or changed certificate."
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteCertificates' AND xtype='U')
    CREATE TABLE RemoteCertificates (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ConnectionId INT NULL REFERENCES RemoteConnections(Id) ON DELETE CASCADE,
      Host NVARCHAR(255) NOT NULL,
      Port INT NOT NULL,
      Fingerprint VARCHAR(200) NOT NULL,
      Subject NVARCHAR(500) NULL,
      Issuer NVARCHAR(500) NULL,
      ValidFrom DATETIME2 NULL,
      ValidTo DATETIME2 NULL,
      IsTrusted BIT NOT NULL DEFAULT 0,
      TrustedAt DATETIME2 NULL,
      TrustedByUserId INT NULL,
      FirstSeenAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      LastSeenAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      IsDeleted BIT NOT NULL DEFAULT 0
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_RemoteCertificates_Host_Port')
    CREATE INDEX IX_RemoteCertificates_Host_Port ON RemoteCertificates (Host, Port)
  `;

  // ForwardType Dynamic (SOCKS) has no fixed RemoteHost/RemotePort - both stay NULL for those rows.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemotePortForwards' AND xtype='U')
    CREATE TABLE RemotePortForwards (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ConnectionId INT NOT NULL REFERENCES RemoteConnections(Id) ON DELETE CASCADE,
      ForwardType VARCHAR(10) NOT NULL,
      LocalPort INT NOT NULL,
      RemoteHost NVARCHAR(255) NULL,
      RemotePort INT NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Stopped',
      StartedByUserId INT NULL,
      StartedAt DATETIME2 NULL,
      StoppedAt DATETIME2 NULL,
      ErrorMessage NVARCHAR(500) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      IsDeleted BIT NOT NULL DEFAULT 0,
      CONSTRAINT CK_RemotePortForwards_ForwardType CHECK (ForwardType IN ('Local','Remote','Dynamic')),
      CONSTRAINT CK_RemotePortForwards_Status CHECK (Status IN ('Active','Stopped','Failed'))
    )
  `;

  // Body is the raw script text (shell/PowerShell/etc) - not a secret by itself, so no
  // encryption here (distinct from RemoteCredentials/RemoteSSHKeys, whose contents ARE secrets).
  // A script body must never be interpolated with unsanitized request input when executed -
  // enforced in the Phase 2 execution route, not here.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteScripts' AND xtype='U')
    CREATE TABLE RemoteScripts (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      Description NVARCHAR(1000) NULL,
      ScriptType VARCHAR(20) NOT NULL,
      Body NVARCHAR(MAX) NOT NULL,
      TargetOsFamily VARCHAR(20) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      IsDeleted BIT NOT NULL DEFAULT 0,
      CONSTRAINT CK_RemoteScripts_ScriptType CHECK (ScriptType IN ('Shell','PowerShell','Python','Batch','Command')),
      CONSTRAINT CK_RemoteScripts_TargetOsFamily CHECK (TargetOsFamily IN ('Linux','Windows','Any') OR TargetOsFamily IS NULL)
    )
  `;

  // BatchId correlates every per-connection row from one bulk "run this script on N
  // connections" click into a single logical execution - NULL for a single-target run.
  // Output is capped at NVARCHAR(MAX) but the execution engine truncates before writing (same
  // bounded-output discipline as RemoteSessionLogs/the Terminal's in-memory ring buffer).
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteScriptExecutions' AND xtype='U')
    CREATE TABLE RemoteScriptExecutions (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ScriptId INT NOT NULL REFERENCES RemoteScripts(Id) ON DELETE CASCADE,
      ConnectionId INT NOT NULL REFERENCES RemoteConnections(Id),
      BatchId UNIQUEIDENTIFIER NULL,
      ExecutedByUserId INT NOT NULL,
      StartedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      EndedAt DATETIME2 NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Running',
      ExitCode INT NULL,
      Output NVARCHAR(MAX) NULL,
      ErrorMessage NVARCHAR(500) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      IsDeleted BIT NOT NULL DEFAULT 0,
      CONSTRAINT CK_RemoteScriptExecutions_Status CHECK (Status IN ('Running','Completed','Failed'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_RemoteScriptExecutions_BatchId')
    CREATE INDEX IX_RemoteScriptExecutions_BatchId ON RemoteScriptExecutions (BatchId)
  `;

  // SCTP diagnostics only - "must be used only for connectivity testing and diagnostics" per
  // the spec, never a real connection protocol. Status is 'NotSupported' by default/always for
  // Phase 2 since Node.js has no native SCTP - this table exists so the UI has a real place to
  // record/display that fact per-host rather than fabricating a result.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteProtocolDiagnostics' AND xtype='U')
    CREATE TABLE RemoteProtocolDiagnostics (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ConnectionId INT NULL REFERENCES RemoteConnections(Id) ON DELETE CASCADE,
      Protocol VARCHAR(20) NOT NULL DEFAULT 'SCTP',
      Host NVARCHAR(255) NOT NULL,
      Port INT NULL,
      Status VARCHAR(20) NOT NULL,
      Method VARCHAR(100) NULL,
      Message NVARCHAR(500) NULL,
      RanByUserId INT NULL,
      RanAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_RemoteProtocolDiagnostics_Status CHECK (Status IN ('Reachable','Unreachable','NotSupported'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_RemoteProtocolDiagnostics_ConnectionId')
    CREATE INDEX IX_RemoteProtocolDiagnostics_ConnectionId ON RemoteProtocolDiagnostics (ConnectionId)
  `;

  console.log("Remote Access Phase 2 schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
