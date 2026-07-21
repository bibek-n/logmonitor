import type { Connection } from "mysql2/promise";
import type { ConnectionPool } from "mssql";
import { getMysqlConnection } from "./connectionMysql";
import { notifyInstanceDown, notifyInstanceRecovered } from "./alerts";
import { appendBlockingEvents, appendDeadlocks, appendTopQueries, getDeadlockWatermark, insertMetricsSnapshot, markInstanceFailed, markInstanceHealthy, replaceActiveSessions, replaceDatabaseSnapshots } from "./persist";
import { collectBackupStatusViaSsh, type BackupStatus } from "./backupStatusSsh";
import type { CollectedBlocking, CollectedDatabase, CollectedDeadlock, CollectedMetrics, CollectedQuery, CollectedSession, InstanceCollectionResult, InstanceToCollect } from "./shared";

const TOP_QUERY_LIMIT = 10;
const TOP_SESSION_LIMIT = 50;

// MySQL exposes a different, smaller set of DMV-equivalents than SQL Server via
// information_schema/performance_schema/sys. Anything SQL Server has no MySQL analog for
// (Page Life Expectancy, per-query memory grants, a true CPU-only time split from wall time,
// a backup catalog) is left null/empty rather than approximated with a misleading fake
// number - each collector below is documented with what it can and can't provide.

async function collectBufferCacheHitRatio(conn: Connection): Promise<number | null> {
  const [rows] = await conn.query<any[]>(
    "SHOW GLOBAL STATUS WHERE Variable_name IN ('Innodb_buffer_pool_read_requests','Innodb_buffer_pool_reads')"
  );
  const map = new Map((rows as any[]).map((r) => [r.Variable_name, Number(r.Value)]));
  const requests = map.get("Innodb_buffer_pool_read_requests") ?? 0;
  const reads = map.get("Innodb_buffer_pool_reads") ?? 0;
  if (requests <= 0) return null;
  return ((requests - reads) / requests) * 100;
}

async function collectMemory(conn: Connection): Promise<{ usedMB: number | null; targetMB: number | null }> {
  let usedMB: number | null = null;
  try {
    const [rows] = await conn.query<any[]>("SELECT SUM(CURRENT_NUMBER_OF_BYTES_USED) AS Bytes FROM performance_schema.memory_summary_global_by_event_name");
    const bytes = (rows as any[])[0]?.Bytes;
    usedMB = bytes != null ? Number(bytes) / 1024 / 1024 : null;
  } catch {
    // performance_schema memory instrumentation may be disabled - degrade to null.
  }

  let targetMB: number | null = null;
  try {
    // Not a literal analog of SQL Server's dynamic "target server memory", but
    // innodb_buffer_pool_size is MySQL's closest configured-memory-ceiling equivalent.
    const [rows] = await conn.query<any[]>("SHOW VARIABLES LIKE 'innodb_buffer_pool_size'");
    const val = (rows as any[])[0]?.Value;
    targetMB = val != null ? Number(val) / 1024 / 1024 : null;
  } catch {
    // ignore
  }

  return { usedMB, targetMB };
}

async function collectActiveSessionDetails(conn: Connection): Promise<CollectedSession[]> {
  const [rows] = await conn.query<any[]>(`
    SELECT ID, USER, HOST, DB, COMMAND, TIME, STATE, INFO
    FROM information_schema.PROCESSLIST
    ORDER BY TIME DESC
    LIMIT ${TOP_SESSION_LIMIT}
  `);
  return (rows as any[]).map((r) => ({
    sessionId: String(r.ID),
    loginName: r.USER ?? null,
    hostName: r.HOST ?? null,
    programName: r.COMMAND ?? null,
    databaseName: r.DB ?? null,
    statusText: r.STATE ?? null,
    cpuTimeMs: null, // MySQL's stock PROCESSLIST doesn't expose per-thread cumulative CPU time
    memoryUsageKB: null, // not exposed per-session without additional performance_schema joins
    lastRequestStartTime: r.TIME != null ? new Date(Date.now() - Number(r.TIME) * 1000) : null,
  }));
}

async function collectDatabases(conn: Connection): Promise<CollectedDatabase[]> {
  const [rows] = await conn.query<any[]>(`
    SELECT table_schema AS DatabaseName, SUM(data_length + index_length) / 1024 / 1024 AS DataSizeMB
    FROM information_schema.tables
    GROUP BY table_schema
  `);
  return (rows as any[]).map((r) => ({
    databaseName: r.DatabaseName,
    stateDesc: "ONLINE",
    recoveryModel: null,
    dataSizeMB: r.DataSizeMB != null ? Number(r.DataSizeMB) : null,
    logSizeMB: null, // MySQL's binary log doesn't map onto SQL Server's per-database log file concept
    logUsedPercent: null,
    lastBackupAt: null, // no built-in backup catalog (no msdb equivalent) to read this from
    lastBackupType: null,
  }));
}

async function collectDeadlockCumulativeCount(conn: Connection): Promise<number | null> {
  try {
    const [rows] = await conn.query<any[]>("SELECT COUNT FROM information_schema.INNODB_METRICS WHERE NAME = 'lock_deadlocks'");
    const val = (rows as any[])[0]?.COUNT;
    return val != null ? Number(val) : null;
  } catch {
    return null;
  }
}

async function collectBlocking(conn: Connection): Promise<CollectedBlocking[]> {
  try {
    // sys.innodb_lock_waits is a standard MySQL 5.7.9+/8.0 helper view; not present on
    // MariaDB or if the `sys` schema was dropped - degrades to no blocking data, not failure.
    const [rows] = await conn.query<any[]>(`
      SELECT waiting_pid, blocking_pid, wait_age_secs, waiting_query, blocking_query
      FROM sys.innodb_lock_waits
    `);
    return (rows as any[]).map((r) => ({
      blockedSessionId: String(r.waiting_pid),
      blockingSessionId: String(r.blocking_pid),
      waitTimeMs: r.wait_age_secs != null ? Math.round(Number(r.wait_age_secs) * 1000) : null,
      waitType: null,
      databaseName: null,
      queryText: r.waiting_query ?? null,
    }));
  } catch {
    return [];
  }
}

async function collectSessionCount(conn: Connection): Promise<number> {
  const [rows] = await conn.query<any[]>("SELECT COUNT(*) AS Cnt FROM information_schema.PROCESSLIST");
  return Number((rows as any[])[0]?.Cnt ?? 0);
}

// MySQL's performance_schema digest table gives total/avg wall-clock time per normalized
// query, which is the closest available proxy for "slow queries" - there is no isolated
// per-query CPU-only time or memory-grant figure in stock instrumentation (unlike SQL
// Server's dm_exec_query_stats), so only the duration ranking is populated; the CPU and
// memory rankings intentionally stay empty for this engine rather than duplicating/faking data.
async function collectTopQueriesByDuration(conn: Connection): Promise<CollectedQuery[]> {
  try {
    const [rows] = await conn.query<any[]>(`
      SELECT
        SCHEMA_NAME AS DatabaseName,
        DIGEST_TEXT AS QueryText,
        AVG_TIMER_WAIT / 1000000 AS AvgDurationMs,
        COUNT_STAR AS ExecutionCount,
        LAST_SEEN AS LastExecutedAt
      FROM performance_schema.events_statements_summary_by_digest
      WHERE COUNT_STAR > 0
      ORDER BY AVG_TIMER_WAIT DESC
      LIMIT ${TOP_QUERY_LIMIT}
    `);
    return (rows as any[]).map((r) => ({
      databaseName: r.DatabaseName ?? null,
      queryText: r.QueryText ?? null,
      avgDurationMs: r.AvgDurationMs != null ? Number(r.AvgDurationMs) : null,
      avgCpuTimeMs: null,
      maxUsedGrantKB: null,
      avgLogicalReads: null,
      avgLogicalWrites: null,
      executionCount: Number(r.ExecutionCount),
      lastExecutedAt: r.LastExecutedAt ?? null,
    }));
  } catch {
    // performance_schema statement digests may be disabled - degrade to no query data.
    return [];
  }
}

// MySQL has no per-query CPU time or memory-grant figure (confirmed live against
// performance_schema.events_statements_summary_by_digest - no CPU_* or *_GRANT_* columns
// exist on MySQL 5.7/8.0), but it DOES track rows_examined/rows_affected per statement
// digest, a genuine (if row-count-based rather than page-based like SQL Server's logical
// reads) proxy for read/write I/O work - reused here as the "reads" ranking rather than
// leaving it unavailable like CPU/memory.
async function collectTopQueriesByReads(conn: Connection): Promise<CollectedQuery[]> {
  try {
    const [rows] = await conn.query<any[]>(`
      SELECT
        SCHEMA_NAME AS DatabaseName,
        DIGEST_TEXT AS QueryText,
        AVG_TIMER_WAIT / 1000000 AS AvgDurationMs,
        SUM_ROWS_EXAMINED / COUNT_STAR AS AvgLogicalReads,
        SUM_ROWS_AFFECTED / COUNT_STAR AS AvgLogicalWrites,
        COUNT_STAR AS ExecutionCount,
        LAST_SEEN AS LastExecutedAt
      FROM performance_schema.events_statements_summary_by_digest
      WHERE COUNT_STAR > 0
      ORDER BY (SUM_ROWS_EXAMINED + SUM_ROWS_AFFECTED) / COUNT_STAR DESC
      LIMIT ${TOP_QUERY_LIMIT}
    `);
    return (rows as any[]).map((r) => ({
      databaseName: r.DatabaseName ?? null,
      queryText: r.QueryText ?? null,
      avgDurationMs: r.AvgDurationMs != null ? Number(r.AvgDurationMs) : null,
      avgCpuTimeMs: null,
      maxUsedGrantKB: null,
      avgLogicalReads: r.AvgLogicalReads != null ? Number(r.AvgLogicalReads) : null,
      avgLogicalWrites: r.AvgLogicalWrites != null ? Number(r.AvgLogicalWrites) : null,
      executionCount: Number(r.ExecutionCount),
      lastExecutedAt: r.LastExecutedAt ?? null,
    }));
  } catch {
    return [];
  }
}

// InnoDB only ever remembers the SINGLE most recent deadlock (SHOW ENGINE INNODB STATUS's
// "LATEST DETECTED DEADLOCK" section is overwritten by the next one, unlike SQL Server's
// extended-events-based deadlock graph history) - dedupe against the last-recorded event's
// own timestamp (embedded as the block's first line, e.g. "2026-07-21 10:15:23 0x...") via
// the same watermark pattern collectorMssql.ts uses, so the same deadlock is never inserted
// twice across repeated scan passes.
async function collectDeadlocks(conn: Connection, watermark: string | null): Promise<CollectedDeadlock[]> {
  try {
    const [rows] = await conn.query<any[]>("SHOW ENGINE INNODB STATUS");
    const statusText: string = (rows as any[])[0]?.Status ?? "";
    const marker = "LATEST DETECTED DEADLOCK";
    const startIdx = statusText.indexOf(marker);
    if (startIdx === -1) return [];

    const after = statusText.slice(startIdx + marker.length);
    const endMatch = after.match(/\n-{4,}\n/);
    const block = (endMatch ? after.slice(0, endMatch.index) : after).trim();
    if (!block) return [];

    const tsMatch = block.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
    if (!tsMatch) return [];
    const detectedAt = tsMatch[1];
    if (watermark && new Date(detectedAt) <= new Date(watermark.replace(/Z$/, ""))) return [];

    const summaryLine = block.split("\n").find((l) => l.trim().startsWith("***")) ?? "Deadlock detected";
    return [{ detectedAt, summary: summaryLine.trim().slice(0, 500), xml: block.slice(0, 8000) }];
  } catch {
    return [];
  }
}

export async function runOneInstanceMysql(db: ConnectionPool, instance: InstanceToCollect): Promise<InstanceCollectionResult> {
  const hostLabel = `${instance.HostName}:${instance.Port}`;
  const startedAt = Date.now();
  try {
    const conn = await getMysqlConnection(instance);
    const deadlockWatermark = await getDeadlockWatermark(db, instance.Id);

    const [bufferCacheHitRatio, memory, sessionDetails, databases, deadlockCumulative, blocking, sessionCount, topByDuration, topByReads, newDeadlocks, backupStatusByDb] = await Promise.all([
      collectBufferCacheHitRatio(conn).catch(() => null),
      collectMemory(conn).catch(() => ({ usedMB: null, targetMB: null })),
      collectActiveSessionDetails(conn).catch(() => []),
      collectDatabases(conn).catch(() => []),
      collectDeadlockCumulativeCount(conn).catch(() => null),
      collectBlocking(conn).catch(() => []),
      collectSessionCount(conn).catch(() => 0),
      collectTopQueriesByDuration(conn).catch(() => []),
      collectTopQueriesByReads(conn).catch(() => []),
      collectDeadlocks(conn, deadlockWatermark).catch(() => []),
      collectBackupStatusViaSsh(instance).catch((): Map<string, BackupStatus> => new Map()),
    ]);

    // Merge in whatever backup status the SSH check found, matched by database name - a no-op
    // (map stays empty, every database keeps lastBackupAt/lastBackupType null) for instances
    // with no SshHost configured, same graceful-degradation convention as every other
    // MySQL-unsupported field in this file.
    for (const database of databases) {
      const status = backupStatusByDb.get(database.databaseName);
      if (status) {
        database.lastBackupAt = status.lastBackupAt;
        database.lastBackupType = status.lastBackupType;
      }
    }

    const metrics: CollectedMetrics = {
      cpuPct: null, // MySQL doesn't expose global CPU% for the server process via portable SQL
      memoryUsedMB: memory.usedMB,
      memoryTargetMB: memory.targetMB,
      bufferCacheHitRatio,
      pageLifeExpectancy: null, // no MySQL analog to SQL Server's buffer pool page life expectancy
      activeSessionCount: sessionCount,
      blockingSessionCount: new Set(blocking.map((b) => b.blockingSessionId)).size,
      deadlockCountCumulative: deadlockCumulative,
    };

    await insertMetricsSnapshot(db, instance.Id, true, metrics);
    await replaceDatabaseSnapshots(db, instance.Id, databases);
    await replaceActiveSessions(db, instance.Id, sessionDetails);
    await appendBlockingEvents(db, instance.Id, blocking);
    await appendTopQueries(db, instance.Id, "duration", topByDuration);
    await appendTopQueries(db, instance.Id, "reads", topByReads);
    await appendDeadlocks(db, instance.Id, newDeadlocks);

    await markInstanceHealthy(db, instance.Id);
    await notifyInstanceRecovered(db, instance.Id, instance.Name, hostLabel, instance.LastCheckStatus);

    const durationMs = Date.now() - startedAt;
    return {
      instanceName: instance.Name,
      status: "Healthy",
      message: `${databases.length} database(s), ${blocking.length} blocking session(s), ${newDeadlocks.length} new deadlock(s) (${durationMs}ms)`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await insertMetricsSnapshot(db, instance.Id, false, null).catch(() => {});
    await markInstanceFailed(db, instance.Id, message);
    await notifyInstanceDown(db, instance.Id, instance.Name, hostLabel, instance.LastCheckStatus, instance.LastDownAlertAt, message);
    return { instanceName: instance.Name, status: "Failed", message };
  }
}
