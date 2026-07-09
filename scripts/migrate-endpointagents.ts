import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='EnrollmentTokens' AND xtype='U')
    CREATE TABLE EnrollmentTokens (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Token VARCHAR(64) NOT NULL UNIQUE,
      CreatedByUserId INT NOT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      ExpiresAt DATETIME2 NOT NULL,
      UsedAt DATETIME2 NULL,
      UsedByDeviceId VARCHAR(36) NULL
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Devices' AND xtype='U')
    CREATE TABLE Devices (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL UNIQUE,
      Hostname NVARCHAR(255) NOT NULL,
      OS VARCHAR(20) NOT NULL,
      OsVersion NVARCHAR(100) NULL,
      ApiKeyHash NVARCHAR(255) NOT NULL,
      StaffId INT NULL,
      Department NVARCHAR(100) NULL,
      AgentVersion NVARCHAR(50) NULL,
      EnrolledAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      LastHeartbeat DATETIME2 NULL,
      LastIp VARCHAR(45) NULL,
      ScreenshotIntervalMinutes INT NULL,
      PrivacyMode BIT NOT NULL DEFAULT 0,
      ConsentAcceptedAt DATETIME2 NULL,
      CONSTRAINT FK_Devices_Staff FOREIGN KEY (StaffId) REFERENCES Staff(Id)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DeviceMetrics' AND xtype='U')
    CREATE TABLE DeviceMetrics (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      ReceivedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CpuPct FLOAT NULL,
      MemPct FLOAT NULL,
      DiskPct FLOAT NULL,
      NetRxMbps FLOAT NULL,
      NetTxMbps FLOAT NULL,
      UptimeSeconds BIGINT NULL,
      CONSTRAINT FK_DeviceMetrics_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_DeviceMetrics_DeviceId_ReceivedAt')
    CREATE INDEX IX_DeviceMetrics_DeviceId_ReceivedAt ON DeviceMetrics (DeviceId, ReceivedAt DESC)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Screenshots' AND xtype='U')
    CREATE TABLE Screenshots (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      CapturedAt DATETIME2 NOT NULL,
      UploadedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      FilePath NVARCHAR(500) NOT NULL,
      FileSizeBytes BIGINT NOT NULL,
      Width INT NULL,
      Height INT NULL,
      CapturedBy VARCHAR(20) NOT NULL,
      RequestedByUserId INT NULL,
      DeletedAt DATETIME2 NULL,
      CONSTRAINT FK_Screenshots_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Screenshots_DeviceId_CapturedAt')
    CREATE INDEX IX_Screenshots_DeviceId_CapturedAt ON Screenshots (DeviceId, CapturedAt DESC)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ScreenshotAuditLog' AND xtype='U')
    CREATE TABLE ScreenshotAuditLog (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ScreenshotId INT NOT NULL,
      UserId INT NOT NULL,
      Action VARCHAR(20) NOT NULL,
      ActionAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      IpAddress VARCHAR(45) NULL,
      CONSTRAINT FK_ScreenshotAuditLog_Screenshots FOREIGN KEY (ScreenshotId) REFERENCES Screenshots(Id)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PendingScreenshotRequests' AND xtype='U')
    CREATE TABLE PendingScreenshotRequests (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      RequestedByUserId INT NOT NULL,
      RequestedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      FulfilledAt DATETIME2 NULL,
      CONSTRAINT FK_PendingScreenshotRequests_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;

  console.log("Endpoint agent tables ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
