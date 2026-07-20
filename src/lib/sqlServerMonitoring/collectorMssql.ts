import { sql } from "@/lib/db";
import type { ConnectionPool } from "mssql";
import { getInstanceConnection } from "./connection";
import { notifyInstanceDown, notifyInstanceRecovered } from "./alerts";
import { appendBlockingEvents, appendDeadlocks, appendTopQueries, getDeadlockWatermark, insertMetricsSnapshot, markInstanceFailed, markInstanceHealthy, replaceActiveSessions, replaceDatabaseSnapshots } from "./persist";
import type { CollectedBlocking, CollectedDatabase, CollectedDeadlock, CollectedQuery, CollectedSession, InstanceCollectionResult, InstanceToCollect } from "./shared";

const TOP_QUERY_LIMIT = 10;
const TOP_SESSION_LIMIT = 50;

// --- Individual DMV-backed collectors - each is a standalone, best-effort query. A failure
// in one (e.g. a permission the monitoring login lacks, like VIEW SERVER STATE for the ring
// buffer queries) degrades that one metric rather than aborting the whole pass. ---

async function collectCpuPct(pool: ConnectionPool): Promise<number | null> {
  const result = await pool.request().query<{ SQLProcessUtilization: number }>(`
    SELECT TOP 1 SQLProcessUtilization
    FROM (
      SELECT
        record.value('(./Record/@id)[1]', 'int') AS record_id,
        record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]', 'int') AS SQLProcessUtilization,
        timestamp
      FROM (
        SELECT timestamp, CONVERT(XML, record) AS record
        FROM sys.dm_os_ring_buffers
        WHERE ring_buffer_type = N'RING_BUFFER_SCHEDULER_MONITOR'
          AND record LIKE '%<SystemHealth>%'
      ) AS x
    ) AS y
    ORDER BY record_id DESC
  `);
  return result.recordset[0]?.SQLProcessUtilization ?? null;
}

async function collectMemory(pool: ConnectionPool): Promise<{ usedMB: number | null; targetMB: number | null }> {
  const result = await pool.request().query<{ MemoryUsedMB: number; MemoryTargetMB: number | null }>(`
    SELECT
      physical_memory_in_use_kb / 1024.0 AS MemoryUsedMB,
      (SELECT cntr_value FROM sys.dm_os_performance_counters WHERE counter_name = 'Target Server Memory (KB)') / 1024.0 AS MemoryTargetMB
    FROM sys.dm_os_process_memory
  `);
  const row = result.recordset[0];
  return { usedMB: row?.MemoryUsedMB ?? null, targetMB: row?.MemoryTargetMB ?? null };
}

async function collectBufferCacheHitRatio(pool: ConnectionPool): Promise<number | null> {
  const result = await pool.request().query<{ BufferCacheHitRatio: number }>(`
    SELECT (a.cntr_value * 1.0 / NULLIF(b.cntr_value, 0)) * 100 AS BufferCacheHitRatio
    FROM sys.dm_os_performance_counters a
    JOIN sys.dm_os_performance_counters b ON a.object_name = b.object_name
    WHERE a.counter_name = 'Buffer cache hit ratio' AND b.counter_name = 'Buffer cache hit ratio base'
      AND a.object_name LIKE '%Buffer Manager%'
  `);
  return result.recordset[0]?.BufferCacheHitRatio ?? null;
}

async function collectPageLifeExpectancy(pool: ConnectionPool): Promise<number | null> {
  const result = await pool.request().query<{ PageLifeExpectancy: number }>(`
    SELECT cntr_value AS PageLifeExpectancy
    FROM sys.dm_os_performance_counters
    WHERE counter_name = 'Page life expectancy' AND object_name LIKE '%Buffer Manager%'
  `);
  return result.recordset[0]?.PageLifeExpectancy ?? null;
}

async function collectSessionCounts(pool: ConnectionPool): Promise<{ active: number; blocking: number }> {
  const result = await pool.request().query<{ ActiveSessionCount: number; BlockingSessionCount: number }>(`
    SELECT
      (SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE is_user_process = 1) AS ActiveSessionCount,
      (SELECT COUNT(DISTINCT blocking_session_id) FROM sys.dm_exec_requests WHERE blocking_session_id <> 0) AS BlockingSessionCount
  `);
  return {
    active: result.recordset[0]?.ActiveSessionCount ?? 0,
    blocking: result.recordset[0]?.BlockingSessionCount ?? 0,
  };
}

// Per-session detail including the login user - the "who is connected" view, not just a
// count. Capped to the busiest N sessions by CPU time rather than every session, so this
// stays useful (and the table bounded) on servers with hundreds of idle connections.
async function collectActiveSessionDetails(pool: ConnectionPool): Promise<CollectedSession[]> {
  const result = await pool.request().query(`
    SELECT TOP ${TOP_SESSION_LIMIT}
      s.session_id AS SessionId, s.login_name AS LoginName, s.host_name AS HostName, s.program_name AS ProgramName,
      DB_NAME(s.database_id) AS DatabaseName, s.status AS StatusText, s.cpu_time AS CpuTimeMs, s.memory_usage * 8 AS MemoryUsageKB,
      s.last_request_start_time AS LastRequestStartTime
    FROM sys.dm_exec_sessions s
    WHERE s.is_user_process = 1
    ORDER BY s.cpu_time DESC
  `);
  return result.recordset.map((r) => ({
    sessionId: String(r.SessionId),
    loginName: r.LoginName,
    hostName: r.HostName,
    programName: r.ProgramName,
    databaseName: r.DatabaseName,
    statusText: r.StatusText,
    cpuTimeMs: r.CpuTimeMs,
    memoryUsageKB: r.MemoryUsageKB,
    lastRequestStartTime: r.LastRequestStartTime,
  }));
}

async function collectDeadlockCumulativeCount(pool: ConnectionPool): Promise<number | null> {
  const result = await pool.request().query<{ Cnt: number }>(`
    SELECT cntr_value AS Cnt FROM sys.dm_os_performance_counters
    WHERE counter_name = 'Number of Deadlocks/sec' AND instance_name = '_Total'
  `);
  return result.recordset[0]?.Cnt ?? null;
}

async function collectDatabases(pool: ConnectionPool): Promise<CollectedDatabase[]> {
  const result = await pool.request().query(`
    SELECT
      d.name AS DatabaseName,
      d.state_desc AS StateDesc,
      d.recovery_model_desc AS RecoveryModel,
      SUM(CASE WHEN mf.type = 0 THEN mf.size * 8.0 / 1024 ELSE 0 END) AS DataSizeMB,
      SUM(CASE WHEN mf.type = 1 THEN mf.size * 8.0 / 1024 ELSE 0 END) AS LogSizeMB
    FROM sys.databases d
    LEFT JOIN sys.master_files mf ON mf.database_id = d.database_id
    GROUP BY d.name, d.state_desc, d.recovery_model_desc
  `);
  return result.recordset.map((r) => ({
    databaseName: r.DatabaseName,
    stateDesc: r.StateDesc,
    recoveryModel: r.RecoveryModel,
    dataSizeMB: r.DataSizeMB,
    logSizeMB: r.LogSizeMB,
    logUsedPercent: null,
    lastBackupAt: null,
    lastBackupType: null,
  }));
}

async function collectLogSpaceUsage(pool: ConnectionPool): Promise<Map<string, number>> {
  // sys.dm_db_log_stats() (SQL Server 2019+) gives transaction log usage % for every online
  // database in one set-based cross-apply. DBCC SQLPERF(LOGSPACE) captured via INSERT...EXEC
  // was tried first but is unreliable over the tedious/TDS driver - it silently truncates to a
  // handful of rows depending on timing, unlike this DMV which returns a consistent full set.
  const result = await pool.request().query<{ DatabaseName: string; LogSpaceUsedPercent: number | null }>(`
    SELECT
      db.name AS DatabaseName,
      CASE WHEN lu.total_log_size_mb > 0 THEN (lu.active_log_size_mb * 100.0 / lu.total_log_size_mb) ELSE NULL END AS LogSpaceUsedPercent
    FROM sys.databases db
    CROSS APPLY sys.dm_db_log_stats(db.database_id) lu
    WHERE db.state = 0
  `);
  const map = new Map<string, number>();
  for (const row of result.recordset) {
    if (row.LogSpaceUsedPercent !== null) map.set(row.DatabaseName, row.LogSpaceUsedPercent);
  }
  return map;
}

async function collectLastBackups(pool: ConnectionPool): Promise<Map<string, { at: string; type: string }>> {
  const map = new Map<string, { at: string; type: string }>();
  try {
    const result = await pool.request().query<{ DatabaseName: string; LastBackupAt: string; LastBackupType: string }>(`
      SELECT database_name AS DatabaseName, MAX(backup_finish_date) AS LastBackupAt, MAX(type) AS LastBackupType
      FROM msdb.dbo.backupset
      GROUP BY database_name
    `);
    for (const row of result.recordset) {
      map.set(row.DatabaseName, { at: row.LastBackupAt, type: row.LastBackupType });
    }
  } catch {
    // msdb may not be reachable for a login without access to it - backups just show as
    // "unknown" rather than failing the whole collection pass.
  }
  return map;
}

async function collectDeadlocks(pool: ConnectionPool, sinceIso: string | null): Promise<CollectedDeadlock[]> {
  try {
    const request = pool.request();
    if (sinceIso) request.input("since", sql.DateTime2, new Date(sinceIso));
    const result = await request.query<{ DetectedAt: string; DeadlockXml: string }>(`
      DECLARE @targetData XML = (
        SELECT CAST(st.target_data AS XML)
        FROM sys.dm_xe_session_targets st
        JOIN sys.dm_xe_sessions s ON s.address = st.event_session_address
        WHERE s.name = 'system_health' AND st.target_name = 'ring_buffer'
      );
      SELECT
        event_xml.value('@timestamp', 'datetime2') AS DetectedAt,
        CAST(event_xml.query('.') AS NVARCHAR(MAX)) AS DeadlockXml
      FROM @targetData.nodes('RingBufferTarget/event[@name="xml_deadlock_report"]') AS T(event_xml)
      ${sinceIso ? "WHERE event_xml.value('@timestamp', 'datetime2') > @since" : ""}
      ORDER BY DetectedAt DESC;
    `);
    return result.recordset.map((r) => ({ detectedAt: r.DetectedAt, summary: `Deadlock detected at ${r.DetectedAt}`, xml: r.DeadlockXml }));
  } catch {
    // VIEW SERVER STATE permission is required for this - degrade gracefully if the
    // monitoring login doesn't have it, rather than failing the whole pass.
    return [];
  }
}

async function collectBlocking(pool: ConnectionPool): Promise<CollectedBlocking[]> {
  const result = await pool.request().query(`
    SELECT
      r.session_id AS BlockedSessionId,
      r.blocking_session_id AS BlockingSessionId,
      r.wait_time AS WaitTimeMs,
      r.wait_type AS WaitType,
      DB_NAME(r.database_id) AS DatabaseName,
      SUBSTRING(st.text, 1, 2000) AS QueryText
    FROM sys.dm_exec_requests r
    OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) st
    WHERE r.blocking_session_id <> 0
  `);
  return result.recordset.map((r) => ({
    blockedSessionId: String(r.BlockedSessionId),
    blockingSessionId: String(r.BlockingSessionId),
    waitTimeMs: r.WaitTimeMs,
    waitType: r.WaitType,
    databaseName: r.DatabaseName,
    queryText: r.QueryText,
  }));
}

// st.dbid (from sys.dm_exec_sql_text) resolves to 0/unresolvable for most parameterized and
// ad-hoc statements (how the Node mssql driver and most ORMs execute queries, via
// sp_executesql), so DB_NAME(st.dbid) came back NULL for nearly every real-world row. The
// plan_handle's 'dbid' attribute is the reliable source - it reflects the actual compilation
// database regardless of how the statement was submitted.
const QUERY_STAT_SELECT_COLUMNS = `
  DB_NAME(TRY_CONVERT(int, epa.value)) AS DatabaseName,
  SUBSTRING(st.text, 1, 4000) AS QueryText,
  qs.total_elapsed_time / qs.execution_count / 1000.0 AS AvgDurationMs,
  qs.total_worker_time / qs.execution_count / 1000.0 AS AvgCpuTimeMs,
  qs.execution_count AS ExecutionCount,
  qs.last_execution_time AS LastExecutedAt
`;
const QUERY_STAT_FROM_JOIN = `
  FROM sys.dm_exec_query_stats qs
  CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
  OUTER APPLY sys.dm_exec_plan_attributes(qs.plan_handle) epa
  WHERE qs.execution_count > 0 AND epa.attribute = 'dbid'
`;

async function collectTopQueriesByDuration(pool: ConnectionPool): Promise<CollectedQuery[]> {
  const result = await pool.request().query(`
    SELECT TOP ${TOP_QUERY_LIMIT} ${QUERY_STAT_SELECT_COLUMNS}
    ${QUERY_STAT_FROM_JOIN}
    ORDER BY AvgDurationMs DESC
  `);
  return mapQueryStatRows(result.recordset);
}

async function collectTopQueriesByCpu(pool: ConnectionPool): Promise<CollectedQuery[]> {
  const result = await pool.request().query(`
    SELECT TOP ${TOP_QUERY_LIMIT} ${QUERY_STAT_SELECT_COLUMNS}
    ${QUERY_STAT_FROM_JOIN}
    ORDER BY AvgCpuTimeMs DESC
  `);
  return mapQueryStatRows(result.recordset);
}

async function collectTopQueriesByMemory(pool: ConnectionPool): Promise<CollectedQuery[]> {
  try {
    // total_grant_kb/max_used_grant_kb were added to sys.dm_exec_query_stats in SQL Server
    // 2016 SP1+ - older/lower editions don't have these columns, so this collector degrades
    // to an empty list (not a failed pass) if the columns don't exist.
    const result = await pool.request().query(`
      SELECT TOP ${TOP_QUERY_LIMIT}
        DB_NAME(TRY_CONVERT(int, epa.value)) AS DatabaseName,
        SUBSTRING(st.text, 1, 4000) AS QueryText,
        qs.total_elapsed_time / qs.execution_count / 1000.0 AS AvgDurationMs,
        qs.max_used_grant_kb AS MaxUsedGrantKB,
        qs.execution_count AS ExecutionCount,
        qs.last_execution_time AS LastExecutedAt
      FROM sys.dm_exec_query_stats qs
      CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
      OUTER APPLY sys.dm_exec_plan_attributes(qs.plan_handle) epa
      WHERE qs.execution_count > 0 AND qs.max_used_grant_kb IS NOT NULL AND epa.attribute = 'dbid'
      ORDER BY MaxUsedGrantKB DESC
    `);
    return mapQueryStatRows(result.recordset);
  } catch {
    return [];
  }
}

function mapQueryStatRows(rows: any[]): CollectedQuery[] {
  return rows.map((r) => ({
    databaseName: r.DatabaseName ?? null,
    queryText: r.QueryText ?? null,
    avgDurationMs: r.AvgDurationMs ?? null,
    avgCpuTimeMs: r.AvgCpuTimeMs ?? null,
    maxUsedGrantKB: r.MaxUsedGrantKB ?? null,
    executionCount: r.ExecutionCount,
    lastExecutedAt: r.LastExecutedAt ?? null,
  }));
}

// --- Orchestration ---

export async function runOneInstanceMssql(db: ConnectionPool, instance: InstanceToCollect): Promise<InstanceCollectionResult> {
  const hostLabel = instance.IsSelfMonitoring ? "self" : `${instance.HostName}:${instance.Port}`;
  const startedAt = Date.now();
  try {
    const pool = await getInstanceConnection(instance);

    const [cpuPct, memory, bufferCacheHitRatio, pageLifeExpectancy, sessions, deadlockCumulative, databases, logSpace, lastBackups, sessionDetails, topByDuration, topByCpu, topByMemory] =
      await Promise.all([
        collectCpuPct(pool).catch(() => null),
        collectMemory(pool).catch(() => ({ usedMB: null, targetMB: null })),
        collectBufferCacheHitRatio(pool).catch(() => null),
        collectPageLifeExpectancy(pool).catch(() => null),
        collectSessionCounts(pool).catch(() => ({ active: 0, blocking: 0 })),
        collectDeadlockCumulativeCount(pool).catch(() => null),
        collectDatabases(pool).catch(() => []),
        collectLogSpaceUsage(pool).catch(() => new Map<string, number>()),
        collectLastBackups(pool),
        collectActiveSessionDetails(pool).catch(() => []),
        collectTopQueriesByDuration(pool).catch(() => []),
        collectTopQueriesByCpu(pool).catch(() => []),
        collectTopQueriesByMemory(pool).catch(() => []),
      ]);

    const databasesWithExtras: CollectedDatabase[] = databases.map((d) => {
      const backup = lastBackups.get(d.databaseName);
      return {
        ...d,
        logUsedPercent: logSpace.get(d.databaseName) ?? null,
        lastBackupAt: backup?.at ?? null,
        lastBackupType: backup?.type ?? null,
      };
    });

    await insertMetricsSnapshot(db, instance.Id, true, {
      cpuPct,
      memoryUsedMB: memory.usedMB,
      memoryTargetMB: memory.targetMB,
      bufferCacheHitRatio,
      pageLifeExpectancy,
      activeSessionCount: sessions.active,
      blockingSessionCount: sessions.blocking,
      deadlockCountCumulative: deadlockCumulative,
    });
    await replaceDatabaseSnapshots(db, instance.Id, databasesWithExtras);
    await replaceActiveSessions(db, instance.Id, sessionDetails);

    const watermark = await getDeadlockWatermark(db, instance.Id);
    const newDeadlocks = await collectDeadlocks(pool, watermark);
    await appendDeadlocks(db, instance.Id, newDeadlocks);

    const blocking = await collectBlocking(pool);
    await appendBlockingEvents(db, instance.Id, blocking);

    await appendTopQueries(db, instance.Id, "duration", topByDuration);
    await appendTopQueries(db, instance.Id, "cpu", topByCpu);
    await appendTopQueries(db, instance.Id, "memory", topByMemory);

    await markInstanceHealthy(db, instance.Id);
    await notifyInstanceRecovered(db, instance.Id, instance.Name, hostLabel, instance.LastCheckStatus);

    const durationMs = Date.now() - startedAt;
    return {
      instanceName: instance.Name,
      status: "Healthy",
      message: `${databasesWithExtras.length} database(s), ${blocking.length} blocking session(s), ${newDeadlocks.length} new deadlock(s) (${durationMs}ms)`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await insertMetricsSnapshot(db, instance.Id, false, null).catch(() => {});
    await markInstanceFailed(db, instance.Id, message);
    await notifyInstanceDown(db, instance.Id, instance.Name, hostLabel, instance.LastCheckStatus, instance.LastDownAlertAt, message);
    return { instanceName: instance.Name, status: "Failed", message };
  }
}
