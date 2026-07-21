import { sql } from "@/lib/db";
import type { ConnectionPool } from "mssql";
import type { CollectedBlocking, CollectedDatabase, CollectedDeadlock, CollectedMetrics, CollectedQuery, CollectedSession, QueryRank } from "./shared";

// Shared write-side helpers for the SQL Server Monitoring feature. Every engine collector
// (MSSQL/MySQL/PostgreSQL) ends up writing into the exact same set of tables in the app's own
// database (the `db` pool here is always the app's own connection, never the monitored
// instance's) - only the COLLECT side differs per engine, so the INSERT/UPDATE statements
// live here once instead of being duplicated three times.

export async function insertMetricsSnapshot(db: ConnectionPool, instanceId: number, isAvailable: boolean, m: CollectedMetrics | null): Promise<void> {
  await db
    .request()
    .input("instanceId", sql.Int, instanceId)
    .input("isAvailable", sql.Bit, isAvailable)
    .input("cpuPct", sql.Float, m?.cpuPct ?? null)
    .input("memoryUsedMB", sql.Float, m?.memoryUsedMB ?? null)
    .input("memoryTargetMB", sql.Float, m?.memoryTargetMB ?? null)
    .input("bufferCacheHitRatio", sql.Float, m?.bufferCacheHitRatio ?? null)
    .input("pageLifeExpectancy", sql.Int, m?.pageLifeExpectancy ?? null)
    .input("activeSessionCount", sql.Int, m?.activeSessionCount ?? null)
    .input("blockingSessionCount", sql.Int, m?.blockingSessionCount ?? null)
    .input("deadlockCountCumulative", sql.BigInt, m?.deadlockCountCumulative ?? null)
    .query(`
      INSERT INTO SqlServerMetricsSnapshots
        (InstanceId, IsAvailable, CpuPct, MemoryUsedMB, MemoryTargetMB, BufferCacheHitRatio, PageLifeExpectancy, ActiveSessionCount, BlockingSessionCount, DeadlockCountCumulative)
      VALUES
        (@instanceId, @isAvailable, @cpuPct, @memoryUsedMB, @memoryTargetMB, @bufferCacheHitRatio, @pageLifeExpectancy, @activeSessionCount, @blockingSessionCount, @deadlockCountCumulative)
    `);
}

export async function replaceDatabaseSnapshots(db: ConnectionPool, instanceId: number, databases: CollectedDatabase[]): Promise<void> {
  await db.request().input("instanceId", sql.Int, instanceId).query("DELETE FROM SqlServerDatabaseSnapshots WHERE InstanceId = @instanceId");
  for (const d of databases) {
    await db
      .request()
      .input("instanceId", sql.Int, instanceId)
      .input("databaseName", sql.NVarChar, d.databaseName)
      .input("stateDesc", sql.VarChar, d.stateDesc)
      .input("recoveryModel", sql.VarChar, d.recoveryModel)
      .input("dataSizeMB", sql.Float, d.dataSizeMB)
      .input("logSizeMB", sql.Float, d.logSizeMB)
      .input("logUsedPercent", sql.Float, d.logUsedPercent)
      .input("lastBackupAt", sql.DateTime2, d.lastBackupAt ? new Date(d.lastBackupAt) : null)
      .input("lastBackupType", sql.VarChar, d.lastBackupType)
      .query(`
        INSERT INTO SqlServerDatabaseSnapshots
          (InstanceId, DatabaseName, StateDesc, RecoveryModel, DataSizeMB, LogSizeMB, LogUsedPercent, LastBackupAt, LastBackupType)
        VALUES
          (@instanceId, @databaseName, @stateDesc, @recoveryModel, @dataSizeMB, @logSizeMB, @logUsedPercent, @lastBackupAt, @lastBackupType)
      `);
  }
}

export async function replaceActiveSessions(db: ConnectionPool, instanceId: number, sessions: CollectedSession[]): Promise<void> {
  await db.request().input("instanceId", sql.Int, instanceId).query("DELETE FROM SqlServerActiveSessions WHERE InstanceId = @instanceId");
  for (const s of sessions) {
    await db
      .request()
      .input("instanceId", sql.Int, instanceId)
      .input("sessionId", sql.VarChar, String(s.sessionId))
      .input("loginName", sql.NVarChar, s.loginName)
      .input("hostName", sql.NVarChar, s.hostName)
      .input("programName", sql.NVarChar, s.programName)
      .input("databaseName", sql.NVarChar, s.databaseName)
      .input("statusText", sql.VarChar, s.statusText)
      .input("cpuTimeMs", sql.BigInt, s.cpuTimeMs)
      .input("memoryUsageKB", sql.BigInt, s.memoryUsageKB)
      .input("lastRequestStartTime", sql.DateTime2, s.lastRequestStartTime ? new Date(s.lastRequestStartTime) : null)
      .query(`
        INSERT INTO SqlServerActiveSessions
          (InstanceId, SessionId, LoginName, HostName, ProgramName, DatabaseName, StatusText, CpuTimeMs, MemoryUsageKB, LastRequestStartTime)
        VALUES
          (@instanceId, @sessionId, @loginName, @hostName, @programName, @databaseName, @statusText, @cpuTimeMs, @memoryUsageKB, @lastRequestStartTime)
      `);
  }
}

export async function getDeadlockWatermark(db: ConnectionPool, instanceId: number): Promise<string | null> {
  // +'Z' so callers' `new Date(watermark)` parses this as the UTC instant it actually is,
  // not local time - see the identical fix (and explanation) in collector.ts's instance SELECT.
  const result = await db
    .request()
    .input("instanceId", sql.Int, instanceId)
    .query<{ MaxDetectedAt: string | null }>(
      "SELECT CONVERT(VARCHAR(19), MAX(DetectedAt), 126) + 'Z' AS MaxDetectedAt FROM SqlServerDeadlockEvents WHERE InstanceId = @instanceId"
    );
  return result.recordset[0]?.MaxDetectedAt ?? null;
}

export async function appendDeadlocks(db: ConnectionPool, instanceId: number, deadlocks: CollectedDeadlock[]): Promise<void> {
  for (const dl of deadlocks) {
    await db
      .request()
      .input("instanceId", sql.Int, instanceId)
      .input("detectedAt", sql.DateTime2, new Date(dl.detectedAt))
      .input("summary", sql.NVarChar, dl.summary)
      .input("xml", sql.NVarChar, dl.xml)
      .query("INSERT INTO SqlServerDeadlockEvents (InstanceId, DetectedAt, Summary, DeadlockGraphXml) VALUES (@instanceId, @detectedAt, @summary, @xml)");
  }
}

export async function appendBlockingEvents(db: ConnectionPool, instanceId: number, events: CollectedBlocking[]): Promise<void> {
  for (const b of events) {
    await db
      .request()
      .input("instanceId", sql.Int, instanceId)
      .input("blockedSessionId", sql.VarChar, b.blockedSessionId)
      .input("blockingSessionId", sql.VarChar, b.blockingSessionId)
      .input("waitTimeMs", sql.Int, b.waitTimeMs)
      .input("waitType", sql.NVarChar, b.waitType)
      .input("databaseName", sql.NVarChar, b.databaseName)
      .input("queryText", sql.NVarChar, b.queryText)
      .query(`
        INSERT INTO SqlServerBlockingEvents (InstanceId, BlockedSessionId, BlockingSessionId, WaitTimeMs, WaitType, DatabaseName, BlockedQueryText)
        VALUES (@instanceId, @blockedSessionId, @blockingSessionId, @waitTimeMs, @waitType, @databaseName, @queryText)
      `);
  }
}

export async function appendTopQueries(db: ConnectionPool, instanceId: number, rankBy: QueryRank, queries: CollectedQuery[]): Promise<void> {
  for (const q of queries) {
    await db
      .request()
      .input("instanceId", sql.Int, instanceId)
      .input("rankBy", sql.VarChar, rankBy)
      .input("databaseName", sql.NVarChar, q.databaseName)
      .input("queryText", sql.NVarChar, q.queryText)
      .input("avgDurationMs", sql.Float, q.avgDurationMs ?? 0)
      .input("avgCpuTimeMs", sql.Float, q.avgCpuTimeMs)
      .input("maxUsedGrantKB", sql.Float, q.maxUsedGrantKB)
      .input("avgLogicalReads", sql.Float, q.avgLogicalReads)
      .input("avgLogicalWrites", sql.Float, q.avgLogicalWrites)
      .input("executionCount", sql.BigInt, q.executionCount)
      .input("lastExecutedAt", sql.DateTime2, q.lastExecutedAt ? new Date(q.lastExecutedAt) : null)
      .query(`
        INSERT INTO SqlServerSlowQueries (InstanceId, RankBy, DatabaseName, QueryText, AvgDurationMs, AvgCpuTimeMs, MaxUsedGrantKB, AvgLogicalReads, AvgLogicalWrites, ExecutionCount, LastExecutedAt)
        VALUES (@instanceId, @rankBy, @databaseName, @queryText, @avgDurationMs, @avgCpuTimeMs, @maxUsedGrantKB, @avgLogicalReads, @avgLogicalWrites, @executionCount, @lastExecutedAt)
      `);
  }
}

export async function markInstanceHealthy(db: ConnectionPool, instanceId: number): Promise<void> {
  await db
    .request()
    .input("instanceId", sql.Int, instanceId)
    .query("UPDATE SqlServerInstances SET LastCheckAt = SYSUTCDATETIME(), LastCheckStatus = 'Healthy', LastErrorMessage = NULL WHERE Id = @instanceId");
}

export async function markInstanceFailed(db: ConnectionPool, instanceId: number, message: string): Promise<void> {
  await db
    .request()
    .input("instanceId", sql.Int, instanceId)
    .input("message", sql.NVarChar, message.slice(0, 1000))
    .query("UPDATE SqlServerInstances SET LastCheckAt = SYSUTCDATETIME(), LastCheckStatus = 'Failed', LastErrorMessage = @message WHERE Id = @instanceId")
    .catch(() => {});
}
