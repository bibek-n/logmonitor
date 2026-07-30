import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// PHP version/error-log viewing for Linux servers - collected by the Go agent (agent/php.go),
// same host-local-only reasoning as Linux Server Security: which PHP versions are installed
// side by side, and where each one's FPM/CLI error log lives, can only be discovered on the box
// itself. A device only gets the "PHP" tab once it reports PhpDetected=1 (Windows agents never
// populate these tables - see PhpDetected()'s runtime.GOOS=="linux" gate).
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "Devices", "PhpDetected", "BIT NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "Devices", "LastPhpCheckAt", "DATETIME2 NULL");

  // Latest-snapshot-per-installed-version (delete-then-insert per pass), same pattern as
  // LinuxOpenPorts/LinuxFail2banJails.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PhpVersions' AND xtype='U')
    CREATE TABLE PhpVersions (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      Version VARCHAR(10) NOT NULL,
      SapiCli BIT NOT NULL DEFAULT 0,
      SapiFpm BIT NOT NULL DEFAULT 0,
      CliErrorLogPath NVARCHAR(500) NULL,
      FpmErrorLogPath NVARCHAR(500) NULL,
      IsDefault BIT NOT NULL DEFAULT 0,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_PhpVersions_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_PhpVersions_DeviceId')
    CREATE INDEX IX_PhpVersions_DeviceId ON PhpVersions (DeviceId)
  `;

  // On-demand log-content requests - "request now, agent picks it up on next heartbeat"
  // pattern, same as PendingMalwareScanRequests/PendingScreenshotRequests, but parameterized by
  // which version+SAPI was asked for (a plain boolean flag isn't enough here). The partial
  // index mirrors PendingMalwareScanRequests's unfulfilled-only index.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PendingPhpLogRequests' AND xtype='U')
    CREATE TABLE PendingPhpLogRequests (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      Version VARCHAR(10) NOT NULL,
      Sapi VARCHAR(10) NOT NULL,
      RequestedByUserId INT NOT NULL,
      RequestedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      FulfilledAt DATETIME2 NULL,
      CONSTRAINT FK_PendingPhpLogRequests_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_PendingPhpLogRequests_DeviceId_Unfulfilled')
    CREATE INDEX IX_PendingPhpLogRequests_DeviceId_Unfulfilled ON PendingPhpLogRequests (DeviceId) WHERE FulfilledAt IS NULL
  `;

  // Latest-fetched-content-per-version+SAPI (upserted by the agent's upload route) - a
  // composite key rather than an identity Id since there's only ever one "current" log view
  // per (device, version, sapi), overwritten on every re-fetch.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PhpLogContent' AND xtype='U')
    CREATE TABLE PhpLogContent (
      DeviceId VARCHAR(36) NOT NULL,
      Version VARCHAR(10) NOT NULL,
      Sapi VARCHAR(10) NOT NULL,
      Content NVARCHAR(MAX) NULL,
      ErrorMessage NVARCHAR(500) NULL,
      FetchedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT PK_PhpLogContent PRIMARY KEY (DeviceId, Version, Sapi),
      CONSTRAINT FK_PhpLogContent_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;

  console.log("PHP monitoring schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
