import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// IIS Monitoring - collected entirely by the existing Go agent (agent/iis.go), since App
// Pool status, per-worker-process (w3wp.exe) stats, and IIS performance counters are all
// host-local and can only be read from the server IIS itself runs on (unlike SQL Server
// Monitoring, which connects out to a target instance). A device only gets an "IIS
// Monitoring" section in the UI once it reports IisDetected=1 - a plain Windows Server
// agent with no IIS role installed simply never populates these tables.
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "Devices", "IisDetected", "BIT NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "Devices", "LastIisCheckAt", "DATETIME2 NULL");

  // Latest-snapshot-per-app-pool (delete-then-insert per pass, same pattern as DeviceDisks).
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='IisAppPools' AND xtype='U')
    CREATE TABLE IisAppPools (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      Name NVARCHAR(200) NOT NULL,
      State VARCHAR(20) NOT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_IisAppPools_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_IisAppPools_DeviceId')
    CREATE INDEX IX_IisAppPools_DeviceId ON IisAppPools (DeviceId)
  `;

  // One row per currently-running w3wp.exe process (delete-then-insert per pass).
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='IisWorkerProcesses' AND xtype='U')
    CREATE TABLE IisWorkerProcesses (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      ProcessId INT NOT NULL,
      AppPoolName NVARCHAR(200) NULL,
      PrivateBytesMB FLOAT NULL,
      CpuPercent FLOAT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_IisWorkerProcesses_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_IisWorkerProcesses_DeviceId')
    CREATE INDEX IX_IisWorkerProcesses_DeviceId ON IisWorkerProcesses (DeviceId)
  `;

  // Latest-snapshot-per-site (delete-then-insert) - availability/response time/status code
  // come from the agent locally probing each binding (http://localhost:<port>/ with the
  // right Host header), and SslExpiresAt is read directly from the bound certificate in the
  // local certificate store, not from a live TLS handshake - both far more reliable than an
  // external HTTP probe would be, since the agent already runs on the box being measured.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='IisSites' AND xtype='U')
    CREATE TABLE IisSites (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      SiteName NVARCHAR(200) NOT NULL,
      State VARCHAR(20) NOT NULL,
      Bindings NVARCHAR(500) NULL,
      IsAvailable BIT NOT NULL DEFAULT 0,
      LastStatusCode INT NULL,
      LastResponseTimeMs FLOAT NULL,
      SslExpiresAt DATETIME2 NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_IisSites_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_IisSites_DeviceId')
    CREATE INDEX IX_IisSites_DeviceId ON IisSites (DeviceId)
  `;

  // Time-series aggregate perf counters (append per pass, same pattern as DeviceMetrics).
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='IisPerfSnapshots' AND xtype='U')
    CREATE TABLE IisPerfSnapshots (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      ReceivedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      WebServiceRequestsPerSec FLOAT NULL,
      CurrentConnections INT NULL,
      AspNetRequestsPerSec FLOAT NULL,
      FailedRequestTraceCount INT NULL,
      CONSTRAINT FK_IisPerfSnapshots_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_IisPerfSnapshots_DeviceId_ReceivedAt')
    CREATE INDEX IX_IisPerfSnapshots_DeviceId_ReceivedAt ON IisPerfSnapshots (DeviceId, ReceivedAt DESC)
  `;

  console.log("IIS Monitoring schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
