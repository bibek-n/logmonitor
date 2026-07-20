import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { InstanceDetailTables } from "@/components/sqlServerMonitoring/InstanceDetailTables";

export const dynamic = "force-dynamic";

function usageTone(pct: number | null): "success" | "warning" | "danger" | "neutral" {
  if (pct === null) return "neutral";
  if (pct >= 90) return "danger";
  if (pct >= 75) return "warning";
  return "success";
}

function pleTone(ple: number | null): "success" | "warning" | "danger" | "neutral" {
  // Below 300s is the long-standing rule-of-thumb threshold for buffer pool memory pressure.
  if (ple === null) return "neutral";
  if (ple < 300) return "danger";
  if (ple < 900) return "warning";
  return "success";
}

// Unlike disk/CPU usage, a HIGH hit ratio is good - low is the problem. Thresholds here are
// a judgment call (SQL Server defines no official cutoff), based on the common guidance that
// a healthy OLTP workload should stay close to 100% and rarely dip below ~90%.
function bufferCacheTone(ratio: number | null): "success" | "warning" | "danger" | "neutral" {
  if (ratio === null) return "neutral";
  if (ratio < 85) return "danger";
  if (ratio < 95) return "warning";
  return "success";
}

export default async function SqlServerInstanceDetailPage({ params }: { params: Promise<{ instanceId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>SQL Server Instance</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view SQL Server monitoring.</p>
      </div>
    );
  }

  const { instanceId } = await params;
  const id = Number(instanceId);
  if (!Number.isInteger(id)) notFound();

  const db = await getDb();
  const instanceResult = await db.request().input("id", sql.Int, id).query(`
    SELECT Id, Name, HostName, Port, AuthType, IsSelfMonitoring, Engine, Enabled,
      CONVERT(VARCHAR(19), LastCheckAt, 126) AS LastCheckAt, LastCheckStatus, LastErrorMessage
    FROM SqlServerInstances WHERE Id = @id
  `);
  const instance = instanceResult.recordset[0];
  if (!instance) notFound();

  const [metricsResult, databasesResult, deadlocksResult, blockingResult, durationQueriesResult, cpuQueriesResult, memoryQueriesResult, sessionsResult] = await Promise.all([
    db.request().input("id", sql.Int, id).query(`
      SELECT TOP 1 CpuPct, MemoryUsedMB, MemoryTargetMB, BufferCacheHitRatio, PageLifeExpectancy, ActiveSessionCount, BlockingSessionCount, DeadlockCountCumulative,
        CONVERT(VARCHAR(19), ReceivedAt, 126) AS ReceivedAt
      FROM SqlServerMetricsSnapshots WHERE InstanceId = @id ORDER BY ReceivedAt DESC
    `),
    db.request().input("id", sql.Int, id).query(`
      SELECT DatabaseName, StateDesc, RecoveryModel, DataSizeMB, LogSizeMB, LogUsedPercent,
        CONVERT(VARCHAR(19), LastBackupAt, 126) AS LastBackupAt, LastBackupType
      FROM SqlServerDatabaseSnapshots WHERE InstanceId = @id ORDER BY DatabaseName ASC
    `),
    db.request().input("id", sql.Int, id).query(`
      SELECT TOP 10 Id, CONVERT(VARCHAR(19), DetectedAt, 126) AS DetectedAt, Summary, DeadlockGraphXml FROM SqlServerDeadlockEvents WHERE InstanceId = @id ORDER BY DetectedAt DESC
    `),
    db.request().input("id", sql.Int, id).query(`
      SELECT TOP 10 Id, CONVERT(VARCHAR(19), DetectedAt, 126) AS DetectedAt, BlockedSessionId, BlockingSessionId, WaitTimeMs, WaitType, DatabaseName, BlockedQueryText
      FROM SqlServerBlockingEvents WHERE InstanceId = @id ORDER BY DetectedAt DESC
    `),
    db.request().input("id", sql.Int, id).query(`
      SELECT TOP 10 Id, CONVERT(VARCHAR(19), DetectedAt, 126) AS DetectedAt, DatabaseName, QueryText, AvgDurationMs, ExecutionCount
      FROM SqlServerSlowQueries WHERE InstanceId = @id AND RankBy = 'duration' ORDER BY DetectedAt DESC, AvgDurationMs DESC
    `),
    db.request().input("id", sql.Int, id).query(`
      SELECT TOP 10 Id, CONVERT(VARCHAR(19), DetectedAt, 126) AS DetectedAt, DatabaseName, QueryText, AvgCpuTimeMs, ExecutionCount
      FROM SqlServerSlowQueries WHERE InstanceId = @id AND RankBy = 'cpu' ORDER BY DetectedAt DESC, AvgCpuTimeMs DESC
    `),
    db.request().input("id", sql.Int, id).query(`
      SELECT TOP 10 Id, CONVERT(VARCHAR(19), DetectedAt, 126) AS DetectedAt, DatabaseName, QueryText, MaxUsedGrantKB, ExecutionCount
      FROM SqlServerSlowQueries WHERE InstanceId = @id AND RankBy = 'memory' ORDER BY DetectedAt DESC, MaxUsedGrantKB DESC
    `),
    db.request().input("id", sql.Int, id).query(`
      SELECT TOP 50 SessionId, LoginName, HostName, ProgramName, DatabaseName, StatusText, CpuTimeMs, MemoryUsageKB,
        CONVERT(VARCHAR(19), LastRequestStartTime, 126) AS LastRequestStartTime
      FROM SqlServerActiveSessions WHERE InstanceId = @id ORDER BY CpuTimeMs DESC
    `),
  ]);

  const metrics = metricsResult.recordset[0] ?? null;
  const databases = databasesResult.recordset;
  const deadlocks = deadlocksResult.recordset;
  const blocking = blockingResult.recordset;
  const durationQueries = durationQueriesResult.recordset;
  const cpuQueries = cpuQueriesResult.recordset;
  const memoryQueries = memoryQueriesResult.recordset;
  const sessions = sessionsResult.recordset;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: "0.25rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>{instance.Name}</h1>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{{ mssql: "SQL Server", mysql: "MySQL", postgres: "PostgreSQL" }[instance.Engine as string] ?? instance.Engine}</Badge>
          <Badge tone={instance.Enabled ? "success" : "neutral"}>{instance.Enabled ? "Monitoring" : "Disabled"}</Badge>
          {instance.LastCheckStatus && <Badge tone={instance.LastCheckStatus === "Healthy" ? "success" : "danger"}>{instance.LastCheckStatus}</Badge>}
        </div>
      </div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        {instance.IsSelfMonitoring ? "This app's own database" : `${instance.HostName}:${instance.Port}`} · Last checked: {instance.LastCheckAt ?? "never"} ·{" "}
        <Link href="/dashboard/sql-monitoring" style={{ color: "var(--primary)" }}>
          Back to instances
        </Link>
      </p>

      {instance.LastErrorMessage && (
        <Card style={{ marginBottom: "1rem", borderColor: "var(--danger)" }}>
          <p style={{ color: "var(--danger)", margin: 0, fontSize: "0.85rem" }}>Last check failed: {instance.LastErrorMessage}</p>
        </Card>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <Card className="flex flex-col gap-2">
          <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Live Health</h3>
          {!metrics ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No data collected yet - waiting for the next monitoring pass.</p>
          ) : (
            <>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}>
                {[
                  ["CPU (SQL Process)", metrics.CpuPct, "%", usageTone(metrics.CpuPct)],
                  ["Buffer Cache Hit", metrics.BufferCacheHitRatio, "%", bufferCacheTone(metrics.BufferCacheHitRatio)],
                ].map(([label, val, unit, tone]) => (
                  <div key={label as string} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 0.6rem" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)", textTransform: "uppercase" }}>{label}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem" }}>
                      <span style={{ fontSize: "1.2rem", fontWeight: 700 }}>{val != null ? (val as number).toFixed(1) : "—"}</span>
                      {val != null && <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>{unit}</span>}
                    </div>
                    <Badge tone={tone as "success" | "warning" | "danger" | "neutral"}>{val != null ? "" : "no data"}</Badge>
                  </div>
                ))}
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 0.6rem" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)", textTransform: "uppercase" }}>Page Life Expectancy</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem" }}>
                    <span style={{ fontSize: "1.2rem", fontWeight: 700 }}>{metrics.PageLifeExpectancy ?? "—"}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>sec</span>
                  </div>
                  <Badge tone={pleTone(metrics.PageLifeExpectancy)}>
                    {metrics.PageLifeExpectancy === null ? "no data" : metrics.PageLifeExpectancy < 300 ? "Low" : metrics.PageLifeExpectancy < 900 ? "Fair" : "Healthy"}
                  </Badge>
                </div>
              </div>
              <dl style={{ margin: 0, fontSize: "0.82rem", marginTop: "0.25rem" }}>
                {[
                  ["Memory In Use", metrics.MemoryUsedMB != null ? `${(metrics.MemoryUsedMB / 1024).toFixed(1)} GB` : "—"],
                  ["Target Server Memory", metrics.MemoryTargetMB != null ? `${(metrics.MemoryTargetMB / 1024).toFixed(1)} GB` : "—"],
                  ["Active Sessions", metrics.ActiveSessionCount ?? "—"],
                  ["Sessions Currently Blocked", metrics.BlockingSessionCount ?? "—"],
                  ["Deadlocks (cumulative, since restart)", metrics.DeadlockCountCumulative ?? "—"],
                  ["Last Sample", metrics.ReceivedAt ?? "—"],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>{label}</dt>
                    <dd style={{ margin: 0 }}>{value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </Card>

        <InstanceDetailTables
          databases={databases}
          deadlocks={deadlocks}
          blocking={blocking}
          durationQueries={durationQueries}
          cpuQueries={cpuQueries}
          memoryQueries={memoryQueries}
          sessions={sessions}
          engine={instance.Engine}
        />
      </div>
    </div>
  );
}
