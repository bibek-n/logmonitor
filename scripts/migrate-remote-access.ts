import "dotenv/config";
import crypto from "crypto";
import { getDb, sql } from "../src/lib/db";

// Remote Access Phase 1: connections/groups, credentials vault, SSH keys, sessions + raw
// session logs, file transfers, an inventory table decoupled from agent enrollment (see the
// approved plan - Devices is always tied to agent enrollment, but Remote Access must target
// arbitrary infrastructure that will often never run this app's agent), a connection-check
// history table (the AvailabilityStatus rollup driver - see run-remote-access-connection-check.ts,
// the concrete fix for the "status never updates" failure class), and a dedicated audit log
// (RemoteAuditLog - distinct from RemoteSessionLogs' raw I/O scrollback).
//
// RemoteCertificates/RemotePortForwards/RemoteScripts/RemoteScriptExecutions/
// RemoteProtocolDiagnostics are Phase 2 - not created here. RemoteConnectionTags is
// deliberately NOT a separate table - Tags follows this app's existing plain-comma-separated-
// column convention (Devices, Websites) instead of introducing a tag-join-table.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteConnectionGroups' AND xtype='U')
    CREATE TABLE RemoteConnectionGroups (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      ParentGroupId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      IsDeleted BIT NOT NULL DEFAULT 0,
      CONSTRAINT FK_RemoteConnectionGroups_Parent FOREIGN KEY (ParentGroupId) REFERENCES RemoteConnectionGroups(Id)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteCredentials' AND xtype='U')
    CREATE TABLE RemoteCredentials (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      CredentialType VARCHAR(30) NOT NULL,
      -- iv:authTag:ciphertext (hex), AES-256-GCM, key via Argon2id (see src/lib/remoteAccess/crypto.ts) -
      -- deliberately a stronger KDF than this app's usual scrypt-based secret encryption, since
      -- this vault's contents grant real remote code execution on real servers.
      EncryptedSecret NVARCHAR(MAX) NOT NULL,
      Username NVARCHAR(200) NULL,
      Domain NVARCHAR(200) NULL,
      ExpiresAt DATETIME2 NULL,
      LastRotatedAt DATETIME2 NULL,
      RotationReminderDays INT NULL,
      LastAccessedAt DATETIME2 NULL,
      LastAccessedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      IsDeleted BIT NOT NULL DEFAULT 0,
      CONSTRAINT CK_RemoteCredentials_Type CHECK (CredentialType IN
        ('UsernamePassword','WindowsDomain','SshKeyPassphrase','Rdp','Ftp','ApiToken','Certificate','Database','Custom'))
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteSSHKeys' AND xtype='U')
    CREATE TABLE RemoteSSHKeys (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      KeyType VARCHAR(20) NOT NULL,
      PublicKey NVARCHAR(MAX) NOT NULL,
      EncryptedPrivateKey NVARCHAR(MAX) NOT NULL,
      Fingerprint VARCHAR(200) NOT NULL,
      PassphraseCredentialId INT NULL,
      ExpiresAt DATETIME2 NULL,
      LastAccessedAt DATETIME2 NULL,
      LastAccessedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      IsDeleted BIT NOT NULL DEFAULT 0,
      CONSTRAINT CK_RemoteSSHKeys_Type CHECK (KeyType IN ('Ed25519','Rsa')),
      CONSTRAINT FK_RemoteSSHKeys_PassphraseCredential FOREIGN KEY (PassphraseCredentialId) REFERENCES RemoteCredentials(Id) ON DELETE SET NULL
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteConnections' AND xtype='U')
    CREATE TABLE RemoteConnections (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      Hostname NVARCHAR(255) NULL,
      IpAddress VARCHAR(45) NULL,
      Port INT NOT NULL,
      Protocol VARCHAR(20) NOT NULL,
      Username NVARCHAR(200) NULL,
      Domain NVARCHAR(200) NULL,
      CredentialId INT NULL,
      SshKeyId INT NULL,
      RemoteDirectory NVARCHAR(1000) NULL,
      OperatingSystem VARCHAR(30) NULL,
      DeviceType VARCHAR(30) NULL,
      Environment VARCHAR(30) NOT NULL DEFAULT 'Production',
      Customer NVARCHAR(200) NULL,
      Location NVARCHAR(200) NULL,
      GroupId INT NULL,
      Tags NVARCHAR(500) NULL,
      Notes NVARCHAR(1000) NULL,
      IsFavorite BIT NOT NULL DEFAULT 0,
      ConnectionTimeoutSeconds INT NOT NULL DEFAULT 15,
      KeepaliveIntervalSeconds INT NOT NULL DEFAULT 30,
      AutoReconnect BIT NOT NULL DEFAULT 0,
      JumpHostConnectionId INT NULL,
      ProxyConfigJson NVARCHAR(MAX) NULL,
      RdpGatewayConfigJson NVARCHAR(MAX) NULL,
      VpnDependencyNote NVARCHAR(500) NULL,
      PreConnectCommand NVARCHAR(1000) NULL,
      PostConnectCommand NVARCHAR(1000) NULL,
      LastSuccessAt DATETIME2 NULL,
      LastFailureAt DATETIME2 NULL,
      AvailabilityStatus VARCHAR(20) NOT NULL DEFAULT 'Unknown',
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      IsDeleted BIT NOT NULL DEFAULT 0,
      CONSTRAINT CK_RemoteConnections_Protocol CHECK (Protocol IN
        ('SSH','RDP','SFTP','SCP','FTP','FTPS','VNC','Telnet','WinRM','WebAdmin','SerialConsole')),
      CONSTRAINT CK_RemoteConnections_Environment CHECK (Environment IN
        ('Production','Staging','Development','Testing','DisasterRecovery','Local','Custom')),
      CONSTRAINT CK_RemoteConnections_Availability CHECK (AvailabilityStatus IN ('Online','Offline','Degraded','Unknown')),
      CONSTRAINT FK_RemoteConnections_Credential FOREIGN KEY (CredentialId) REFERENCES RemoteCredentials(Id) ON DELETE SET NULL,
      CONSTRAINT FK_RemoteConnections_SshKey FOREIGN KEY (SshKeyId) REFERENCES RemoteSSHKeys(Id) ON DELETE SET NULL,
      CONSTRAINT FK_RemoteConnections_Group FOREIGN KEY (GroupId) REFERENCES RemoteConnectionGroups(Id) ON DELETE SET NULL,
      CONSTRAINT FK_RemoteConnections_JumpHost FOREIGN KEY (JumpHostConnectionId) REFERENCES RemoteConnections(Id)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_RemoteConnections_GroupId')
    CREATE INDEX IX_RemoteConnections_GroupId ON RemoteConnections (GroupId)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_RemoteConnections_AvailabilityStatus')
    CREATE INDEX IX_RemoteConnections_AvailabilityStatus ON RemoteConnections (AvailabilityStatus)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteSessions' AND xtype='U')
    CREATE TABLE RemoteSessions (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ConnectionId INT NULL REFERENCES RemoteConnections(Id),
      SessionType VARCHAR(20) NOT NULL,
      Protocol VARCHAR(20) NOT NULL,
      TargetHost NVARCHAR(255) NOT NULL,
      TargetPort INT NOT NULL,
      IsAdHoc BIT NOT NULL DEFAULT 0,
      StartedByUserId INT NOT NULL,
      StartedByUsername NVARCHAR(100) NULL,
      StartedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      EndedAt DATETIME2 NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Active',
      RecordingStatus VARCHAR(20) NOT NULL DEFAULT 'NotRecorded',
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      IsDeleted BIT NOT NULL DEFAULT 0,
      CONSTRAINT CK_RemoteSessions_SessionType CHECK (SessionType IN ('Terminal','Sftp')),
      CONSTRAINT CK_RemoteSessions_Status CHECK (Status IN ('Active','Ended','Failed','Terminated')),
      CONSTRAINT CK_RemoteSessions_RecordingStatus CHECK (RecordingStatus IN ('NotRecorded','Recording','Recorded'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_RemoteSessions_Status')
    CREATE INDEX IX_RemoteSessions_Status ON RemoteSessions (Status)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteSessionLogs' AND xtype='U')
    CREATE TABLE RemoteSessionLogs (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      SessionId INT NOT NULL REFERENCES RemoteSessions(Id) ON DELETE CASCADE,
      Sequence BIGINT NOT NULL,
      Direction VARCHAR(10) NOT NULL,
      Content NVARCHAR(MAX) NOT NULL,
      LoggedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_RemoteSessionLogs_Direction CHECK (Direction IN ('Input','Output'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_RemoteSessionLogs_SessionId_Sequence')
    CREATE INDEX IX_RemoteSessionLogs_SessionId_Sequence ON RemoteSessionLogs (SessionId, Sequence)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteFileTransfers' AND xtype='U')
    CREATE TABLE RemoteFileTransfers (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      SessionId INT NULL REFERENCES RemoteSessions(Id),
      ConnectionId INT NOT NULL REFERENCES RemoteConnections(Id),
      Direction VARCHAR(10) NOT NULL,
      LocalPath NVARCHAR(2000) NULL,
      RemotePath NVARCHAR(2000) NOT NULL,
      SizeBytes BIGINT NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Completed',
      Checksum VARCHAR(128) NULL,
      ErrorMessage NVARCHAR(500) NULL,
      StartedByUserId INT NOT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      IsDeleted BIT NOT NULL DEFAULT 0,
      CONSTRAINT CK_RemoteFileTransfers_Direction CHECK (Direction IN ('Upload','Download')),
      CONSTRAINT CK_RemoteFileTransfers_Status CHECK (Status IN ('Completed','Failed','InProgress'))
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteInventoryDevices' AND xtype='U')
    CREATE TABLE RemoteInventoryDevices (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      LinkedDeviceId VARCHAR(36) NULL REFERENCES Devices(DeviceId),
      LinkedConnectionId INT NULL REFERENCES RemoteConnections(Id),
      DeviceName NVARCHAR(200) NOT NULL,
      Hostname NVARCHAR(255) NULL,
      IpAddress VARCHAR(45) NULL,
      MacAddress VARCHAR(20) NULL,
      OperatingSystem VARCHAR(30) NULL,
      OsVersion NVARCHAR(100) NULL,
      DeviceTypeCategory VARCHAR(30) NULL,
      Cpu NVARCHAR(200) NULL,
      Memory NVARCHAR(100) NULL,
      Disk NVARCHAR(100) NULL,
      Environment VARCHAR(30) NULL,
      Customer NVARCHAR(200) NULL,
      Owner NVARCHAR(200) NULL,
      Location NVARCHAR(200) NULL,
      AssetNumber NVARCHAR(100) NULL,
      SerialNumber NVARCHAR(100) NULL,
      AvailableProtocolsJson NVARCHAR(500) NULL,
      OpenManagementPortsJson NVARCHAR(500) NULL,
      MonitoringStatus VARCHAR(20) NULL,
      AvailabilityStatus VARCHAR(20) NOT NULL DEFAULT 'Unknown',
      LastConnectionAt DATETIME2 NULL,
      Tags NVARCHAR(500) NULL,
      Notes NVARCHAR(1000) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      IsDeleted BIT NOT NULL DEFAULT 0,
      CONSTRAINT CK_RemoteInventoryDevices_DeviceTypeCategory CHECK (DeviceTypeCategory IN
        ('WindowsServer','LinuxServer','Pc','NetworkDevice','VirtualMachine','Container','Cloud') OR DeviceTypeCategory IS NULL),
      CONSTRAINT CK_RemoteInventoryDevices_Availability CHECK (AvailabilityStatus IN ('Online','Offline','Degraded','Unknown'))
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteConnectionChecks' AND xtype='U')
    CREATE TABLE RemoteConnectionChecks (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      ConnectionId INT NOT NULL REFERENCES RemoteConnections(Id) ON DELETE CASCADE,
      CheckedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      Status VARCHAR(20) NOT NULL,
      LatencyMs INT NULL,
      ErrorMessage NVARCHAR(500) NULL,
      CONSTRAINT CK_RemoteConnectionChecks_Status CHECK (Status IN ('Online','Offline','Degraded'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_RemoteConnectionChecks_ConnectionId_CheckedAt')
    CREATE INDEX IX_RemoteConnectionChecks_ConnectionId_CheckedAt ON RemoteConnectionChecks (ConnectionId, CheckedAt DESC)
  `;

  // Never stores passwords/private keys/tokens/passphrases/complete command secrets - enforced
  // in src/lib/remoteAccess/auditLog.ts's single writer function, not left to each call site.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteAuditLog' AND xtype='U')
    CREATE TABLE RemoteAuditLog (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      EventType VARCHAR(40) NOT NULL,
      UserId INT NULL,
      Username NVARCHAR(100) NULL,
      Protocol VARCHAR(20) NULL,
      ConnectionId INT NULL REFERENCES RemoteConnections(Id) ON DELETE SET NULL,
      Host NVARCHAR(255) NULL,
      SourceIp VARCHAR(45) NULL,
      SessionId INT NULL,
      Action NVARCHAR(200) NULL,
      Result VARCHAR(20) NOT NULL,
      FailureReason NVARCHAR(500) NULL,
      DurationMs INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_RemoteAuditLog_Result CHECK (Result IN ('Success','Failure'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_RemoteAuditLog_CreatedAt')
    CREATE INDEX IX_RemoteAuditLog_CreatedAt ON RemoteAuditLog (CreatedAt DESC)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_RemoteAuditLog_EventType')
    CREATE INDEX IX_RemoteAuditLog_EventType ON RemoteAuditLog (EventType)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteAccessSettings' AND xtype='U')
    CREATE TABLE RemoteAccessSettings (
      Id INT PRIMARY KEY DEFAULT 1,
      VaultSaltHex VARCHAR(64) NOT NULL,
      VaultLockAfterMinutes INT NOT NULL DEFAULT 15,
      DefaultConnectionTimeoutSeconds INT NOT NULL DEFAULT 15,
      DefaultKeepaliveIntervalSeconds INT NOT NULL DEFAULT 30,
      ConnectionCheckIntervalMinutes INT NOT NULL DEFAULT 5,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      CONSTRAINT CK_RemoteAccessSettings_Singleton CHECK (Id = 1)
    )
  `;

  // Seed the singleton settings row with a fresh random vault salt - generated once, never
  // regenerated by re-running this migration (existing encrypted secrets are derived from it).
  const saltHex = crypto.randomBytes(32).toString("hex");
  await db
    .request()
    .input("saltHex", sql.VarChar, saltHex)
    .query("IF NOT EXISTS (SELECT * FROM RemoteAccessSettings WHERE Id = 1) INSERT INTO RemoteAccessSettings (Id, VaultSaltHex) VALUES (1, @saltHex)");

  console.log("Remote Access schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
