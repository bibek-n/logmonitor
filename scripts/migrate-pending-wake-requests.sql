-- Wake-on-LAN relay queue: one row per "ask an online agent on the target's subnet to send a
-- magic packet for TargetMac". See src/app/api/admin/devices/[deviceId]/power-on/route.ts.
IF OBJECT_ID('dbo.PendingWakeRequests', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PendingWakeRequests (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    RelayDeviceId VARCHAR(100) NOT NULL,
    TargetDeviceId VARCHAR(100) NOT NULL,
    TargetMac VARCHAR(17) NOT NULL,
    RequestedByUserId INT NULL,
    RequestedAt DATETIME2 NOT NULL CONSTRAINT DF_PendingWakeRequests_RequestedAt DEFAULT SYSUTCDATETIME(),
    ExpiresAt DATETIME2 NOT NULL,
    FulfilledAt DATETIME2 NULL
  );
  CREATE INDEX IX_PendingWakeRequests_Relay ON dbo.PendingWakeRequests (RelayDeviceId, FulfilledAt) INCLUDE (ExpiresAt, TargetMac);
END
