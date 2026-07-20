import type { Client } from "pg";
import type { ConnectionPool } from "mssql";
import { getPostgresConnection } from "./connectionPostgres";
import { notifyInstanceDown, notifyInstanceRecovered } from "./alerts";
import { appendBlockingEvents, appendTopQueries, insertMetricsSnapshot, markInstanceFailed, markInstanceHealthy, replaceActiveSessions, replaceDatabaseSnapshots } from "./persist";
import type { CollectedBlocking, CollectedDatabase, CollectedMetrics, CollectedQuery, CollectedSession, InstanceCollectionResult, InstanceToCollect } from "./shared";

const TOP_QUERY_LIMIT = 10;
const TOP_SESSION_LIMIT = 50;

// Same "don't fake it" policy as the MySQL collector: PostgreSQL has no analog to Page Life
// Expectancy, no built-in backup catalog, and no per-query CPU/memory split (pg_stat_statements
// gives wall-clock time and I/O block counts, not CPU-only time or a memory grant) - those
// stay null/empty rather than being approximated.

async function collectBufferCacheHitRatio(client: Client): Promise<number | null> {
  const result = await client.query<{ hit_ratio: number | null }>(`
    SELECT CASE WHEN SUM(blks_hit + blks_read) > 0 THEN SUM(blks_hit) * 100.0 / SUM(blks_hit + blks_read) ELSE NULL END AS hit_ratio
    FROM pg_stat_database
  `);
  const val = result.rows[0]?.hit_ratio;
  return val != null ? Number(val) : null;
}

async function collectMemoryTargetMB(client: Client): Promise<number | null> {
  try {
    const result = await client.query<{ setting: string; unit: string | null }>("SELECT setting, unit FROM pg_settings WHERE name = 'shared_buffers'");
    const row = result.rows[0];
    if (!row) return null;
    const value = Number(row.setting);
    if (row.unit === "8kB") return (value * 8) / 1024;
    if (row.unit === "kB") return value / 1024;
    if (row.unit === "MB") return value;
    return null;
  } catch {
    return null;
  }
}

async function collectActiveSessionDetails(client: Client): Promise<CollectedSession[]> {
  const result = await client.query<any>(`
    SELECT pid, usename, COALESCE(client_hostname, host(client_addr)) AS host_name, application_name, datname, state, query_start, backend_start
    FROM pg_stat_activity
    WHERE pid <> pg_backend_pid()
    ORDER BY query_start ASC NULLS LAST
    LIMIT ${TOP_SESSION_LIMIT}
  `);
  return result.rows.map((r: any) => ({
    sessionId: String(r.pid),
    loginName: r.usename ?? null,
    hostName: r.host_name ?? null,
    programName: r.application_name ?? null,
    databaseName: r.datname ?? null,
    statusText: r.state ?? null,
    cpuTimeMs: null, // Postgres doesn't expose per-backend cumulative CPU time via SQL
    memoryUsageKB: null, // not exposed per-session without OS-level (e.g. /proc) instrumentation
    lastRequestStartTime: r.query_start ?? r.backend_start ?? null,
  }));
}

async function collectDatabases(client: Client): Promise<CollectedDatabase[]> {
  const result = await client.query<any>(`
    SELECT datname, pg_database_size(datname) / 1024.0 / 1024.0 AS data_size_mb
    FROM pg_database
    WHERE datistemplate = false
  `);
  return result.rows.map((r: any) => ({
    databaseName: r.datname,
    stateDesc: "ONLINE",
    recoveryModel: null,
    dataSizeMB: r.data_size_mb != null ? Number(r.data_size_mb) : null,
    logSizeMB: null, // WAL isn't tracked per-database the way SQL Server tracks a log file per database
    logUsedPercent: null,
    lastBackupAt: null, // no built-in backup catalog to read this from
    lastBackupType: null,
  }));
}

async function collectDeadlockCumulativeCount(client: Client): Promise<number | null> {
  const result = await client.query<{ total: string | null }>("SELECT SUM(deadlocks) AS total FROM pg_stat_database");
  const val = result.rows[0]?.total;
  return val != null ? Number(val) : null;
}

// The canonical PostgreSQL wiki self-join query for "who is blocking whom" via pg_locks.
async function collectBlocking(client: Client): Promise<CollectedBlocking[]> {
  try {
    const result = await client.query<any>(`
      SELECT
        blocked_activity.pid AS blocked_pid,
        blocking_activity.pid AS blocking_pid,
        EXTRACT(EPOCH FROM (now() - blocked_activity.query_start)) * 1000 AS wait_ms,
        blocked_activity.datname,
        blocked_activity.query AS blocked_query
      FROM pg_catalog.pg_locks blocked_locks
      JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
      JOIN pg_catalog.pg_locks blocking_locks
        ON blocking_locks.locktype = blocked_locks.locktype
        AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
        AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
        AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
        AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
        AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
        AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
        AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
        AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
        AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
        AND blocking_locks.pid != blocked_locks.pid
      JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
      WHERE NOT blocked_locks.granted
    `);
    return result.rows.map((r: any) => ({
      blockedSessionId: String(r.blocked_pid),
      blockingSessionId: String(r.blocking_pid),
      waitTimeMs: r.wait_ms != null ? Math.round(Number(r.wait_ms)) : null,
      waitType: null,
      databaseName: r.datname ?? null,
      queryText: r.blocked_query ?? null,
    }));
  } catch {
    return [];
  }
}

async function collectSessionCount(client: Client): Promise<number> {
  const result = await client.query<{ cnt: string }>("SELECT COUNT(*) AS cnt FROM pg_stat_activity WHERE pid <> pg_backend_pid()");
  return Number(result.rows[0]?.cnt ?? 0);
}

// Requires the pg_stat_statements extension (not installed/enabled by default) - degrades to
// no query data rather than failing the pass if it's unavailable. Column names target
// PostgreSQL 13+ (mean_exec_time/total_exec_time replaced the older mean_time/total_time).
async function collectTopQueriesByDuration(client: Client): Promise<CollectedQuery[]> {
  try {
    const result = await client.query<any>(`
      SELECT query, calls, mean_exec_time, max_exec_time
      FROM pg_stat_statements
      ORDER BY mean_exec_time DESC
      LIMIT ${TOP_QUERY_LIMIT}
    `);
    return result.rows.map((r: any) => ({
      databaseName: null,
      queryText: r.query ?? null,
      avgDurationMs: r.mean_exec_time != null ? Number(r.mean_exec_time) : null,
      avgCpuTimeMs: null,
      maxUsedGrantKB: null,
      executionCount: Number(r.calls ?? 0),
      lastExecutedAt: null,
    }));
  } catch {
    return [];
  }
}

export async function runOneInstancePostgres(db: ConnectionPool, instance: InstanceToCollect): Promise<InstanceCollectionResult> {
  const hostLabel = `${instance.HostName}:${instance.Port}`;
  const startedAt = Date.now();
  try {
    const client = await getPostgresConnection(instance);

    const [bufferCacheHitRatio, memoryTargetMB, sessionDetails, databases, deadlockCumulative, blocking, sessionCount, topByDuration] = await Promise.all([
      collectBufferCacheHitRatio(client).catch(() => null),
      collectMemoryTargetMB(client).catch(() => null),
      collectActiveSessionDetails(client).catch(() => []),
      collectDatabases(client).catch(() => []),
      collectDeadlockCumulativeCount(client).catch(() => null),
      collectBlocking(client).catch(() => []),
      collectSessionCount(client).catch(() => 0),
      collectTopQueriesByDuration(client).catch(() => []),
    ]);

    const metrics: CollectedMetrics = {
      cpuPct: null, // Postgres doesn't expose server-process CPU% via portable SQL
      memoryUsedMB: null, // no built-in view of actual memory in use, unlike SQL Server's dm_os_process_memory
      memoryTargetMB,
      bufferCacheHitRatio,
      pageLifeExpectancy: null, // no Postgres analog to SQL Server's buffer pool page life expectancy
      activeSessionCount: sessionCount,
      blockingSessionCount: new Set(blocking.map((b) => b.blockingSessionId)).size,
      deadlockCountCumulative: deadlockCumulative,
    };

    await insertMetricsSnapshot(db, instance.Id, true, metrics);
    await replaceDatabaseSnapshots(db, instance.Id, databases);
    await replaceActiveSessions(db, instance.Id, sessionDetails);
    await appendBlockingEvents(db, instance.Id, blocking);
    await appendTopQueries(db, instance.Id, "duration", topByDuration);

    await markInstanceHealthy(db, instance.Id);
    await notifyInstanceRecovered(db, instance.Id, instance.Name, hostLabel, instance.LastCheckStatus);

    const durationMs = Date.now() - startedAt;
    return { instanceName: instance.Name, status: "Healthy", message: `${databases.length} database(s), ${blocking.length} blocking session(s) (${durationMs}ms)` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await insertMetricsSnapshot(db, instance.Id, false, null).catch(() => {});
    await markInstanceFailed(db, instance.Id, message);
    await notifyInstanceDown(db, instance.Id, instance.Name, hostLabel, instance.LastCheckStatus, instance.LastDownAlertAt, message);
    return { instanceName: instance.Name, status: "Failed", message };
  }
}
