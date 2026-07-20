import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// Extends the SQL Server Monitoring feature (see migrate-sqlserver-monitoring.ts) with:
//  - multi-engine support (MySQL/PostgreSQL alongside the original MSSQL-only design)
//  - per-session login/host detail (SqlServerActiveSessions), not just a session count
//  - top-10 query rankings by CPU time and memory grant, alongside the existing duration
//    ranking (SqlServerSlowQueries gains a RankBy discriminator + two new metric columns)
//  - down/recovery email alert cooldown tracking (SqlServerInstances.LastDownAlertAt)
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "SqlServerInstances", "Engine", "VARCHAR(20) NOT NULL DEFAULT 'mssql'");
  await addColumnIfMissing(db, "SqlServerInstances", "LastDownAlertAt", "DATETIME2 NULL");
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_SqlServerInstances_Engine')
    ALTER TABLE SqlServerInstances ADD CONSTRAINT CK_SqlServerInstances_Engine CHECK (Engine IN ('mssql','mysql','postgres'))
  `);

  // Backfill: the existing POST route always wrote AuthType 'sql'/'windows' with SQL Server
  // semantics - every pre-existing row is genuinely an MSSQL instance, so the column default
  // above already gives them the correct value with no further backfill needed.

  // Per-session detail including the login user - "who is connected right now", capped to the
  // busiest N sessions per pass (not every idle connection) and fully replaced each pass, same
  // delete-then-insert pattern as SqlServerDatabaseSnapshots ("what does it look like right now").
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SqlServerActiveSessions' AND xtype='U')
    CREATE TABLE SqlServerActiveSessions (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      InstanceId INT NOT NULL,
      SessionId VARCHAR(30) NOT NULL,
      LoginName NVARCHAR(200) NULL,
      HostName NVARCHAR(200) NULL,
      ProgramName NVARCHAR(300) NULL,
      DatabaseName NVARCHAR(200) NULL,
      StatusText VARCHAR(30) NULL,
      CpuTimeMs BIGINT NULL,
      MemoryUsageKB BIGINT NULL,
      LastRequestStartTime DATETIME2 NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_SqlServerActiveSessions_Instance FOREIGN KEY (InstanceId) REFERENCES SqlServerInstances(Id)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SqlServerActiveSessions_InstanceId')
    CREATE INDEX IX_SqlServerActiveSessions_InstanceId ON SqlServerActiveSessions (InstanceId)
  `;

  // SqlServerSlowQueries becomes a general "top query rankings" table - RankBy distinguishes
  // which metric a given snapshot pass was sorted by (only 'duration' existed before this
  // migration; 'cpu' and 'memory' are new). AvgDurationMs is always populated regardless of
  // rank (useful context either way); AvgCpuTimeMs/MaxUsedGrantKB only for their own ranking.
  await addColumnIfMissing(db, "SqlServerSlowQueries", "RankBy", "VARCHAR(10) NOT NULL DEFAULT 'duration'");
  await addColumnIfMissing(db, "SqlServerSlowQueries", "AvgCpuTimeMs", "FLOAT NULL");
  await addColumnIfMissing(db, "SqlServerSlowQueries", "MaxUsedGrantKB", "FLOAT NULL");
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_SqlServerSlowQueries_RankBy')
    ALTER TABLE SqlServerSlowQueries ADD CONSTRAINT CK_SqlServerSlowQueries_RankBy CHECK (RankBy IN ('duration','cpu','memory'))
  `);

  console.log("SQL Server Monitoring v2 schema ready (multi-engine, sessions, top CPU/memory queries, down-alert cooldown).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
