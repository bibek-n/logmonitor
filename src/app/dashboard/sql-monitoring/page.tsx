import { getAdminSession } from "@/lib/requireAdmin";
import { getDb, sql } from "@/lib/db";
import { InstancesListClient } from "@/components/sqlServerMonitoring/InstancesListClient";

export const dynamic = "force-dynamic";

export default async function SqlServerMonitoringPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>SQL Server Monitoring</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view SQL Server monitoring.</p>
      </div>
    );
  }

  interface InstanceListRow {
    Id: number;
    Name: string;
    HostName: string;
    Port: number;
    AuthType: string;
    IsSelfMonitoring: boolean;
    Engine: string;
    Enabled: boolean;
    LastCheckAt: string | null;
    LastCheckStatus: string | null;
    LastErrorMessage: string | null;
    HasSshBackupCheck: boolean;
  }
  interface LatestMetricsRow {
    InstanceId: number;
    CpuPct: number | null;
    MemoryUsedMB: number | null;
    PageLifeExpectancy: number | null;
    ActiveSessionCount: number | null;
    IsAvailable: boolean;
  }

  const db = await getDb();
  const instancesResult = await db.query<InstanceListRow>`
    SELECT Id, Name, HostName, Port, AuthType, IsSelfMonitoring, Engine, Enabled,
      CONVERT(VARCHAR(19), LastCheckAt, 126) AS LastCheckAt, LastCheckStatus, LastErrorMessage,
      CASE WHEN SshHost IS NOT NULL THEN 1 ELSE 0 END AS HasSshBackupCheck
    FROM SqlServerInstances ORDER BY IsSelfMonitoring DESC, Name ASC
  `;
  const instanceIds = instancesResult.recordset.map((i) => i.Id);

  let latestMetrics: Record<number, LatestMetricsRow> = {};
  if (instanceIds.length > 0) {
    // instanceIds are freshly-read INT IDENTITY values from our own DB (never request
    // input), so interpolating them into the IN (...) list is safe - matches the
    // established pattern for trusted, DB-sourced integer lists elsewhere in this app.
    const idList = instanceIds.filter((n) => Number.isInteger(n)).join(",");
    const metricsResult = await db.request().query<LatestMetricsRow>(`
      SELECT m.InstanceId, m.CpuPct, m.MemoryUsedMB, m.PageLifeExpectancy, m.ActiveSessionCount, m.IsAvailable
      FROM SqlServerMetricsSnapshots m
      INNER JOIN (
        SELECT InstanceId, MAX(Id) AS MaxId FROM SqlServerMetricsSnapshots WHERE InstanceId IN (${idList}) GROUP BY InstanceId
      ) latest ON latest.MaxId = m.Id
    `);
    latestMetrics = Object.fromEntries(metricsResult.recordset.map((r) => [r.InstanceId, r]));
  }

  const instances = instancesResult.recordset.map((i) => ({ ...i, latestMetrics: latestMetrics[i.Id] ?? null }));

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>SQL Server Monitoring</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Database availability, size, sessions, deadlocks, blocking, slow queries, backups, CPU/memory, buffer cache hit ratio, and page life
        expectancy - collected directly from each instance&apos;s own system views, no agent or paid tooling required.
      </p>
      <InstancesListClient initialInstances={instances} />
    </div>
  );
}
