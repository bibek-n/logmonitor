import "dotenv/config";
import { getDb, sql } from "../src/lib/db";
import { REMOTE_SUPPORT_PERMISSION_KEYS } from "../src/lib/requireRemoteSupportPermission";

// Remote Support: consent-based screen view/control sessions with an employee's Windows PC.
// See the Phase 1 architecture doc for the full design - this migration creates the 4 new
// tables plus seeds the permission keys onto the existing RolePermissions mechanism (no schema
// change needed there, same generic role->key grant table every other permissioned module uses).
async function main() {
  const db = await getDb();

  await db.query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteSupportSessions' AND xtype='U')
    CREATE TABLE RemoteSupportSessions (
      Id                  INT IDENTITY(1,1) PRIMARY KEY,
      SessionGuid         UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
      DeviceId            VARCHAR(36) NOT NULL,
      RequestedByUserId    INT NOT NULL,
      Reason              NVARCHAR(500) NOT NULL,
      Status              VARCHAR(20) NOT NULL DEFAULT 'Pending',
      ApprovalNonce       VARCHAR(64) NOT NULL,
      RequestedAt         DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      ExpiresAt           DATETIME2 NOT NULL,
      RespondedAt         DATETIME2 NULL,
      Approved            BIT NULL,
      StartedAt           DATETIME2 NULL,
      EndedAt             DATETIME2 NULL,
      TerminationReason   VARCHAR(30) NULL,
      PermissionsGranted  VARCHAR(100) NOT NULL DEFAULT 'view',
      SourceIp            VARCHAR(45) NOT NULL,
      CreatedAt           DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_RemoteSupportSessions_Device FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId),
      CONSTRAINT FK_RemoteSupportSessions_User FOREIGN KEY (RequestedByUserId) REFERENCES Users(Id)
    )
  `);
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_RemoteSupportSessions_Device' AND object_id = OBJECT_ID('RemoteSupportSessions'))
    CREATE INDEX IX_RemoteSupportSessions_Device ON RemoteSupportSessions(DeviceId, Status)
  `);
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_RemoteSupportSessions_Status' AND object_id = OBJECT_ID('RemoteSupportSessions'))
    CREATE INDEX IX_RemoteSupportSessions_Status ON RemoteSupportSessions(Status, ExpiresAt)
  `);

  await db.query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteSessionEvents' AND xtype='U')
    CREATE TABLE RemoteSessionEvents (
      Id          INT IDENTITY(1,1) PRIMARY KEY,
      SessionId   INT NOT NULL,
      EventType   VARCHAR(40) NOT NULL,
      DetailsJson NVARCHAR(MAX) NULL,
      CreatedAt   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_RemoteSessionEvents_Session FOREIGN KEY (SessionId) REFERENCES RemoteSupportSessions(Id)
    )
  `);
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_RemoteSessionEvents_Session' AND object_id = OBJECT_ID('RemoteSessionEvents'))
    CREATE INDEX IX_RemoteSessionEvents_Session ON RemoteSessionEvents(SessionId, CreatedAt)
  `);

  await db.query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteSessionSignaling' AND xtype='U')
    CREATE TABLE RemoteSessionSignaling (
      Id          INT IDENTITY(1,1) PRIMARY KEY,
      SessionId   INT NOT NULL,
      Direction   VARCHAR(20) NOT NULL,
      MessageType VARCHAR(20) NOT NULL,
      Payload     NVARCHAR(MAX) NOT NULL,
      ConsumedAt  DATETIME2 NULL,
      CreatedAt   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_RemoteSessionSignaling_Session FOREIGN KEY (SessionId) REFERENCES RemoteSupportSessions(Id)
    )
  `);
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_RemoteSessionSignaling_Poll' AND object_id = OBJECT_ID('RemoteSessionSignaling'))
    CREATE INDEX IX_RemoteSessionSignaling_Poll ON RemoteSessionSignaling(SessionId, Direction, ConsumedAt)
  `);

  await db.query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteSessionFileTransfers' AND xtype='U')
    CREATE TABLE RemoteSessionFileTransfers (
      Id                    INT IDENTITY(1,1) PRIMARY KEY,
      SessionId             INT NOT NULL,
      Direction             VARCHAR(20) NOT NULL,
      FileName              NVARCHAR(260) NOT NULL,
      SizeBytes             BIGINT NOT NULL,
      ApprovedByEmployeeAt  DATETIME2 NULL,
      Status                VARCHAR(20) NOT NULL DEFAULT 'PendingApproval',
      CreatedAt             DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CompletedAt           DATETIME2 NULL,
      CONSTRAINT FK_RemoteSessionFileTransfers_Session FOREIGN KEY (SessionId) REFERENCES RemoteSupportSessions(Id)
    )
  `);
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_RemoteSessionFileTransfers_Session' AND object_id = OBJECT_ID('RemoteSessionFileTransfers'))
    CREATE INDEX IX_RemoteSessionFileTransfers_Session ON RemoteSessionFileTransfers(SessionId)
  `);

  // Seed the permission keys as explicit (unallowed) rows for every non-system role so they
  // show up in the Users & Access UI ready to toggle on, rather than silently defaulting to
  // "denied because the row doesn't exist" with no visible control for it.
  const rolesResult = await db.query<{ Id: number; Name: string }>(`SELECT Id, Name FROM Roles WHERE Name <> 'Admin'`);
  for (const role of rolesResult.recordset) {
    for (const key of REMOTE_SUPPORT_PERMISSION_KEYS) {
      const existing = await db
        .request()
        .input("roleId", sql.Int, role.Id)
        .input("key", sql.NVarChar, key)
        .query<{ Id: number }>("SELECT Id FROM RolePermissions WHERE RoleId = @roleId AND PermissionKey = @key");
      if (existing.recordset.length === 0) {
        await db
          .request()
          .input("roleId", sql.Int, role.Id)
          .input("key", sql.NVarChar, key)
          .query("INSERT INTO RolePermissions (RoleId, PermissionKey, Allowed) VALUES (@roleId, @key, 0)");
      }
    }
  }

  console.log("Remote Support tables ready (RemoteSupportSessions, RemoteSessionEvents, RemoteSessionSignaling, RemoteSessionFileTransfers) + permission keys seeded.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
