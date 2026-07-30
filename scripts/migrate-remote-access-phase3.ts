import "dotenv/config";
import { getDb } from "../src/lib/db";

// Remote Access Phase 3: shared/private connections (IsShared), monitoring-integration and
// bulk-execution-approval settings, and a generic approval-request table. Session recording and
// the Docker/K8s terminal reuse existing Phase 1/2 tables (RemoteSessions/RemoteSessionLogs,
// RemoteConnections) with no schema changes - see connectionService.ts and the new
// containerService.ts.
async function main() {
  const db = await getDb();

  // Existing connections default to IsShared=1 (visible to everyone with ra_connections_view,
  // matching the behavior every connection has had since Phase 1 - "shared connections" is
  // additive: a creator can now flip a connection to private, not a behavior change for anyone
  // who never touches the new field).
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('RemoteConnections') AND name = 'IsShared')
    ALTER TABLE RemoteConnections ADD IsShared BIT NOT NULL DEFAULT 1
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('RemoteAccessSettings') AND name = 'NotifyOnConnectionOfflineContactIds')
    ALTER TABLE RemoteAccessSettings ADD NotifyOnConnectionOfflineContactIds NVARCHAR(500) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('RemoteAccessSettings') AND name = 'RequireApprovalForBulkExecution')
    ALTER TABLE RemoteAccessSettings ADD RequireApprovalForBulkExecution BIT NOT NULL DEFAULT 0
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('RemoteAccessSettings') AND name = 'BulkExecutionApprovalThreshold')
    ALTER TABLE RemoteAccessSettings ADD BulkExecutionApprovalThreshold INT NOT NULL DEFAULT 5
  `;

  // Generic approval-request queue - Phase 3 wires exactly one gate into it (bulk script
  // execution above the configured threshold), documented as the concrete example of how a
  // second sensitive action (e.g. Production connection deletion) could be gated the same way
  // later, without inventing a bespoke workflow table per action type.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RemoteApprovalRequests' AND xtype='U')
    CREATE TABLE RemoteApprovalRequests (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ActionType VARCHAR(50) NOT NULL,
      Payload NVARCHAR(MAX) NOT NULL,
      Summary NVARCHAR(500) NOT NULL,
      RequestedByUserId INT NOT NULL,
      RequestedByUsername NVARCHAR(100) NOT NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Pending',
      ReviewedByUserId INT NULL,
      ReviewedByUsername NVARCHAR(100) NULL,
      ReviewNote NVARCHAR(500) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      ReviewedAt DATETIME2 NULL,
      CONSTRAINT CK_RemoteApprovalRequests_Status CHECK (Status IN ('Pending','Approved','Rejected'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_RemoteApprovalRequests_Status')
    CREATE INDEX IX_RemoteApprovalRequests_Status ON RemoteApprovalRequests (Status)
  `;

  console.log("Remote Access Phase 3 schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
