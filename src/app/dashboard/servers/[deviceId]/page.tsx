import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ServerDetailActions } from "@/components/servers/ServerDetailActions";
import { ServerDetailTabs } from "@/components/servers/ServerDetailTabs";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  Active: "success",
  Pending: "neutral",
  Maintenance: "warning",
  Decommissioned: "danger",
};

function isOnline(lastHeartbeat: string | null): boolean {
  if (!lastHeartbeat) return false;
  return Date.now() - new Date(lastHeartbeat).getTime() < 5 * 60 * 1000;
}

function formatUptime(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function usageTone(pct: number | null): "success" | "warning" | "danger" | "neutral" {
  if (pct === null) return "neutral";
  if (pct >= 90) return "danger";
  if (pct >= 75) return "warning";
  return "success";
}

interface ServiceEntry {
  name: string;
  displayName?: string;
  status: string;
  startupType?: string;
}

const MAX_SERVICES_SHOWN = 50;

export default async function ServerDetailPage({ params }: { params: Promise<{ deviceId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Server</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view server details.</p>
      </div>
    );
  }

  const { deviceId } = await params;

  const db = await getDb();
  const deviceResult = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .query(`
      SELECT DeviceId, DeviceName, Hostname, StaticIpAddress, LastIp, ServerRole, OS, OsVersion, LifecycleStatus,
        MacAddress, Manufacturer, Model, SerialNumber, BiosVersion, MotherboardSerial, AgentVersion,
        CONVERT(VARCHAR(19), LastHeartbeat, 126) AS LastHeartbeat,
        CONVERT(VARCHAR(19), EnrolledAt, 126) AS EnrolledAt,
        CONVERT(VARCHAR(19), LastBootTime, 126) AS LastBootTime,
        CONVERT(VARCHAR(19), LastWindowsUpdateAt, 126) AS LastWindowsUpdateAt,
        RecentHotfixCount, RebootPending, IisDetected,
        CONVERT(VARCHAR(19), LastIisCheckAt, 126) AS LastIisCheckAt,
        LinuxSecurityDetected, CONVERT(VARCHAR(19), LastLinuxSecurityCheckAt, 126) AS LastLinuxSecurityCheckAt
      FROM Devices WHERE DeviceId = @deviceId AND DeviceType = 'Server'
    `);
  const device = deviceResult.recordset[0];
  if (!device) notFound();
  const isLinux = device.OS?.toLowerCase() === "linux";

  const [
    hardwareResult,
    disksResult,
    interfacesResult,
    logCountResult,
    metricsResult,
    serviceSnapshotResult,
    recentHealthLogsResult,
    iisAppPoolsResult,
    iisSitesResult,
    iisWorkerProcessesResult,
    iisPerfResult,
    linuxSecurityResult,
    linuxOpenPortsResult,
    linuxFail2banJailsResult,
    linuxPermissionFindingsResult,
    linuxSudoEntriesResult,
    volumesResult,
  ] = await Promise.all([
    db.request().input("deviceId", sql.VarChar, deviceId).query(`
      SELECT CpuModel, CpuManufacturer, CpuCores, CpuThreads, CpuClockMhz, MemoryTotalMB,
        MotherboardManufacturer, MotherboardModel, BiosManufacturer, BiosReleaseDate,
        OsEdition, OsBuild, KernelVersion, Architecture, CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
      FROM DeviceHardwareInfo WHERE DeviceId = @deviceId
    `),
    db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT DiskIndex, Model, Type, CapacityGB, HealthStatus, OperationalStatus, TemperatureCelsius FROM DeviceDisks WHERE DeviceId = @deviceId ORDER BY DiskIndex ASC"),
    db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT InterfaceName, MacAddress, IpAddresses, IsUp, SpeedMbps FROM DeviceNetworkInterfaces WHERE DeviceId = @deviceId"),
    db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT COUNT(*) AS Cnt FROM ServerLogEntries WHERE DeviceId = @deviceId"),
    db.request().input("deviceId", sql.VarChar, deviceId).query(`
      SELECT TOP 1 CpuPct, MemPct, DiskPct, DiskLatencyMs, NetRxMbps, NetTxMbps, UptimeSeconds,
        CONVERT(VARCHAR(19), ReceivedAt, 126) AS ReceivedAt
      FROM DeviceMetrics WHERE DeviceId = @deviceId ORDER BY ReceivedAt DESC
    `),
    db.request().input("deviceId", sql.VarChar, deviceId).query(
      "SELECT ServicesJson, CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt FROM DeviceServiceSnapshot WHERE DeviceId = @deviceId"
    ),
    db.request().input("deviceId", sql.VarChar, deviceId).query(`
      SELECT TOP 10 Id, CONVERT(VARCHAR(19), ReceivedAt, 126) AS ReceivedAt, LogSource, Severity, Message
      FROM ServerLogEntries WHERE DeviceId = @deviceId AND LogSource IN ('eventlog', 'reboot')
      ORDER BY ReceivedAt DESC
    `),
    db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT Name, State FROM IisAppPools WHERE DeviceId = @deviceId ORDER BY Name ASC"),
    db.request().input("deviceId", sql.VarChar, deviceId).query(`
      SELECT SiteName, State, Bindings, IsAvailable, LastStatusCode, LastResponseTimeMs, CONVERT(VARCHAR(19), SslExpiresAt, 126) AS SslExpiresAt
      FROM IisSites WHERE DeviceId = @deviceId ORDER BY SiteName ASC
    `),
    db.request().input("deviceId", sql.VarChar, deviceId).query(
      "SELECT ProcessId, AppPoolName, PrivateBytesMB, CpuPercent FROM IisWorkerProcesses WHERE DeviceId = @deviceId ORDER BY PrivateBytesMB DESC"
    ),
    db.request().input("deviceId", sql.VarChar, deviceId).query(`
      SELECT TOP 1 WebServiceRequestsPerSec, CurrentConnections, AspNetRequestsPerSec, FailedRequestTraceCount,
        CONVERT(VARCHAR(19), ReceivedAt, 126) AS ReceivedAt
      FROM IisPerfSnapshots WHERE DeviceId = @deviceId ORDER BY ReceivedAt DESC
    `),
    db.request().input("deviceId", sql.VarChar, deviceId).query(`
      SELECT SshPort, SshPermitRootLogin, SshPasswordAuthentication, SshServiceActive,
        FirewallType, FirewallActive, FirewallRuleCount, Fail2banInstalled, Fail2banActive,
        SelinuxStatus, ApparmorStatus, ApparmorEnforceCount, ApparmorComplainCount,
        WorldWritableFileCount, SuidBinaryCount, SudoNopasswdCount,
        CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
      FROM LinuxSecurityStatus WHERE DeviceId = @deviceId
    `),
    db.request().input("deviceId", sql.VarChar, deviceId).query(
      "SELECT Protocol, Address, Port, ProcessName FROM LinuxOpenPorts WHERE DeviceId = @deviceId ORDER BY Port ASC"
    ),
    db.request().input("deviceId", sql.VarChar, deviceId).query(
      "SELECT JailName, CurrentlyBanned, TotalBanned FROM LinuxFail2banJails WHERE DeviceId = @deviceId ORDER BY JailName ASC"
    ),
    db.request().input("deviceId", sql.VarChar, deviceId).query(
      "SELECT IssueType, Path FROM LinuxPermissionFindings WHERE DeviceId = @deviceId ORDER BY IssueType ASC, Path ASC"
    ),
    db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT Entry FROM LinuxSudoNopasswdEntries WHERE DeviceId = @deviceId ORDER BY Entry ASC"),
    db.request().input("deviceId", sql.VarChar, deviceId).query(
      "SELECT MountPoint, Device, FsType, TotalGB, FreeGB, UsedPercent FROM DeviceVolumes WHERE DeviceId = @deviceId ORDER BY MountPoint ASC"
    ),
  ]);
  const hw = hardwareResult.recordset[0];
  const disks = disksResult.recordset;
  const interfaces = interfacesResult.recordset;
  const logCount = logCountResult.recordset[0]?.Cnt ?? 0;
  const metrics = metricsResult.recordset[0] ?? null;
  const recentHealthLogs = recentHealthLogsResult.recordset;
  const iisAppPools = iisAppPoolsResult.recordset;
  const iisSites = iisSitesResult.recordset;
  const iisWorkerProcesses = iisWorkerProcessesResult.recordset;
  const iisPerf = iisPerfResult.recordset[0] ?? null;
  const linuxSecurity = linuxSecurityResult.recordset[0] ?? null;
  const linuxOpenPorts = linuxOpenPortsResult.recordset;
  const linuxFail2banJails = linuxFail2banJailsResult.recordset;
  const linuxWorldWritable = linuxPermissionFindingsResult.recordset.filter((r) => r.IssueType === "world_writable");
  const linuxSuidBinaries = linuxPermissionFindingsResult.recordset.filter((r) => r.IssueType === "suid");
  const linuxSudoEntries = linuxSudoEntriesResult.recordset;
  const volumes = volumesResult.recordset;

  let services: ServiceEntry[] = [];
  const serviceSnapshot = serviceSnapshotResult.recordset[0];
  if (serviceSnapshot?.ServicesJson) {
    try {
      const parsed = JSON.parse(serviceSnapshot.ServicesJson);
      if (Array.isArray(parsed)) services = parsed;
    } catch {
      // malformed snapshot - render as "no data" rather than crashing the page
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: "0.25rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>{device.DeviceName || device.Hostname || "(unnamed)"}</h1>
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[device.LifecycleStatus] ?? "neutral"}>{device.LifecycleStatus}</Badge>
          <Badge tone={isOnline(device.LastHeartbeat) ? "success" : "neutral"}>{isOnline(device.LastHeartbeat) ? "Online" : "Offline"}</Badge>
          <ServerDetailActions
            server={{
              DeviceId: device.DeviceId,
              DeviceName: device.DeviceName,
              ServerRole: device.ServerRole,
              StaticIpAddress: device.StaticIpAddress,
              MacAddress: device.MacAddress,
              LifecycleStatus: device.LifecycleStatus,
            }}
          />
        </div>
      </div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "0.75rem" }}>
        {device.Hostname || "Pending enrollment"} · {device.ServerRole ?? "No role set"}
      </p>

      <ServerDetailTabs deviceId={deviceId} active="overview" logCount={logCount} />

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <Card className="flex flex-col gap-2">
          <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Overview</h3>
          <dl style={{ margin: 0, fontSize: "0.82rem" }}>
            {[
              ["IP Address", device.StaticIpAddress ?? device.LastIp ?? "—"],
              ["MAC Address", device.MacAddress ?? "—"],
              ["Operating System", `${device.OS}${device.OsVersion ? ` (${device.OsVersion})` : ""}`],
              ["Manufacturer / Model", `${device.Manufacturer ?? "—"} / ${device.Model ?? "—"}`],
              ["Serial Number", device.SerialNumber ?? "—"],
              ["BIOS Version", device.BiosVersion ?? "—"],
              ["Motherboard Serial", device.MotherboardSerial ?? "—"],
              ["Agent Version", device.AgentVersion ?? "—"],
              ["Enrolled", device.EnrolledAt ?? "Not yet enrolled"],
              ["Last Heartbeat", device.LastHeartbeat ?? "Never"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                <dt style={{ color: "var(--ink-muted)" }}>{label}</dt>
                <dd style={{ margin: 0 }}>{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="flex flex-col gap-2">
          <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Hardware</h3>
          {hw ? (
            <dl style={{ margin: 0, fontSize: "0.82rem" }}>
              {[
                ["CPU", `${hw.CpuModel ?? "—"} (${hw.CpuCores ?? "?"}c/${hw.CpuThreads ?? "?"}t, ${hw.CpuClockMhz ? `${hw.CpuClockMhz} MHz` : "—"})`],
                ["Memory", hw.MemoryTotalMB ? `${(hw.MemoryTotalMB / 1024).toFixed(1)} GB` : "—"],
                ["Motherboard", `${hw.MotherboardManufacturer ?? "—"} ${hw.MotherboardModel ?? ""}`.trim() || "—"],
                ["BIOS", `${hw.BiosManufacturer ?? "—"}${hw.BiosReleaseDate ? ` (${hw.BiosReleaseDate})` : ""}`],
                ["OS Edition", hw.OsEdition ?? "—"],
                ["Kernel / Build", hw.KernelVersion ?? hw.OsBuild ?? "—"],
                ["Architecture", hw.Architecture ?? "—"],
                ["Last Synced", hw.UpdatedAt ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                  <dt style={{ color: "var(--ink-muted)" }}>{label}</dt>
                  <dd style={{ margin: 0 }}>{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No hardware data synced yet — waiting for the agent's first check-in.</p>
          )}
        </Card>

        <Card className="flex flex-col gap-2">
          <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Storage</h3>
          {disks.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No disk data synced yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "0.3rem" }}>#</th>
                  <th style={{ padding: "0.3rem" }}>Model</th>
                  <th style={{ padding: "0.3rem" }}>Type</th>
                  <th style={{ padding: "0.3rem" }}>Capacity</th>
                  <th style={{ padding: "0.3rem" }}>Health</th>
                  <th style={{ padding: "0.3rem" }}>Temp</th>
                </tr>
              </thead>
              <tbody>
                {disks.map((d) => (
                  <tr key={d.DiskIndex}>
                    <td style={{ padding: "0.3rem" }}>{d.DiskIndex}</td>
                    <td style={{ padding: "0.3rem" }}>{d.Model ?? "—"}</td>
                    <td style={{ padding: "0.3rem" }}>{d.Type ?? "—"}</td>
                    <td style={{ padding: "0.3rem" }}>{d.CapacityGB ? `${d.CapacityGB.toFixed(0)} GB` : "—"}</td>
                    <td style={{ padding: "0.3rem" }}>
                      {d.HealthStatus ? (
                        <Badge tone={d.HealthStatus === "Healthy" ? "success" : d.HealthStatus === "Warning" ? "warning" : "danger"}>
                          {d.HealthStatus}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ padding: "0.3rem" }}>{d.TemperatureCelsius != null ? `${d.TemperatureCelsius.toFixed(0)}°C` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="flex flex-col gap-2">
          <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Disk Volumes</h3>
          {volumes.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No volume data synced yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "0.3rem" }}>Drive / Mount</th>
                  <th style={{ padding: "0.3rem" }}>Filesystem</th>
                  <th style={{ padding: "0.3rem" }}>Total</th>
                  <th style={{ padding: "0.3rem" }}>Free</th>
                  <th style={{ padding: "0.3rem" }}>Used</th>
                </tr>
              </thead>
              <tbody>
                {volumes.map((v, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: "0.3rem", fontFamily: "monospace" }}>{v.MountPoint}</td>
                    <td style={{ padding: "0.3rem" }}>{v.FsType ?? "—"}</td>
                    <td style={{ padding: "0.3rem" }}>{v.TotalGB != null ? `${v.TotalGB.toFixed(0)} GB` : "—"}</td>
                    <td style={{ padding: "0.3rem" }}>{v.FreeGB != null ? `${v.FreeGB.toFixed(1)} GB` : "—"}</td>
                    <td style={{ padding: "0.3rem" }}>
                      {v.UsedPercent != null ? <Badge tone={usageTone(v.UsedPercent)}>{v.UsedPercent.toFixed(0)}%</Badge> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="flex flex-col gap-2">
          <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Network Interfaces</h3>
          {interfaces.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No interface data synced yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "0.3rem" }}>Name</th>
                  <th style={{ padding: "0.3rem" }}>MAC</th>
                  <th style={{ padding: "0.3rem" }}>IP(s)</th>
                  <th style={{ padding: "0.3rem" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {interfaces.map((i, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: "0.3rem" }}>{i.InterfaceName ?? "—"}</td>
                    <td style={{ padding: "0.3rem", fontFamily: "monospace" }}>{i.MacAddress ?? "—"}</td>
                    <td style={{ padding: "0.3rem" }}>{i.IpAddresses ?? "—"}</td>
                    <td style={{ padding: "0.3rem" }}>
                      <Badge tone={i.IsUp ? "success" : "neutral"}>{i.IsUp ? "Up" : "Down"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="flex flex-col gap-2">
          <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Live Health</h3>
          {!metrics ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No metrics synced yet — waiting for the agent's first check-in.</p>
          ) : (
            <>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}>
                {[
                  ["CPU", metrics.CpuPct, "%"],
                  ["RAM", metrics.MemPct, "%"],
                  ["Disk", metrics.DiskPct, "%"],
                ].map(([label, pct, unit]) => (
                  <div key={label as string} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 0.6rem" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)", textTransform: "uppercase" }}>{label}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem" }}>
                      <span style={{ fontSize: "1.2rem", fontWeight: 700 }}>{pct != null ? (pct as number).toFixed(0) : "—"}</span>
                      {pct != null && <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>{unit}</span>}
                    </div>
                    <Badge tone={usageTone(pct as number | null)}>{pct != null ? ((pct as number) >= 90 ? "High" : (pct as number) >= 75 ? "Elevated" : "Normal") : "—"}</Badge>
                  </div>
                ))}
              </div>
              <dl style={{ margin: 0, fontSize: "0.82rem", marginTop: "0.25rem" }}>
                {[
                  ["Disk Latency", metrics.DiskLatencyMs != null ? `${metrics.DiskLatencyMs.toFixed(1)} ms` : "—"],
                  ["Network Rx / Tx", `${metrics.NetRxMbps?.toFixed(1) ?? "—"} / ${metrics.NetTxMbps?.toFixed(1) ?? "—"} Mbps`],
                  ["Uptime", formatUptime(metrics.UptimeSeconds)],
                  ["Last Sample", metrics.ReceivedAt ?? "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>{label}</dt>
                    <dd style={{ margin: 0 }}>{value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </Card>

        <Card className="flex flex-col gap-2">
          <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>
            {isLinux ? "System Updates & Reboots" : "Windows Updates & Reboots"}
          </h3>
          <dl style={{ margin: 0, fontSize: "0.82rem" }}>
            {[
              ["Last Update Installed", device.LastWindowsUpdateAt ?? "—"],
              [isLinux ? "Packages Updated (last 30 days)" : "Hotfixes (last 30 days)", device.RecentHotfixCount ?? "—"],
              ["Last Boot Time", device.LastBootTime ?? (metrics ? formatUptime(metrics.UptimeSeconds) + " ago (from uptime)" : "—")],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                <dt style={{ color: "var(--ink-muted)" }}>{label}</dt>
                <dd style={{ margin: 0 }}>{value}</dd>
              </div>
            ))}
            <div className="flex justify-between" style={{ padding: "0.25rem 0" }}>
              <dt style={{ color: "var(--ink-muted)" }}>Reboot Pending</dt>
              <dd style={{ margin: 0 }}>
                {device.RebootPending === null ? (
                  "—"
                ) : (
                  <Badge tone={device.RebootPending ? "warning" : "success"}>{device.RebootPending ? "Yes" : "No"}</Badge>
                )}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="flex flex-col gap-2">
          <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>{isLinux ? "Linux Services" : "Windows Services"}</h3>
          {services.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No service data synced yet.</p>
          ) : (
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.3rem" }}>Name</th>
                    <th style={{ padding: "0.3rem" }}>Status</th>
                    <th style={{ padding: "0.3rem" }}>Startup</th>
                  </tr>
                </thead>
                <tbody>
                  {services.slice(0, MAX_SERVICES_SHOWN).map((s, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: "0.3rem" }}>{s.displayName || s.name}</td>
                      <td style={{ padding: "0.3rem" }}>
                        <Badge tone={s.status === "running" ? "success" : s.status === "stopped" ? "neutral" : "warning"}>{s.status}</Badge>
                      </td>
                      <td style={{ padding: "0.3rem" }}>{s.startupType ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {services.length > MAX_SERVICES_SHOWN && (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.74rem", margin: 0 }}>
              Showing first {MAX_SERVICES_SHOWN} of {services.length} services.
            </p>
          )}
        </Card>

        <Card className="flex flex-col gap-2">
          <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>
            {isLinux ? "Recent System Log & Reboot Entries" : "Recent Event Viewer & Reboot Entries"}
          </h3>
          {recentHealthLogs.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No Critical/Error events or reboots recorded yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "0.3rem" }}>Time</th>
                  <th style={{ padding: "0.3rem" }}>Severity</th>
                  <th style={{ padding: "0.3rem" }}>Message</th>
                </tr>
              </thead>
              <tbody>
                {recentHealthLogs.map((l) => (
                  <tr key={l.Id}>
                    <td style={{ padding: "0.3rem", whiteSpace: "nowrap" }}>{l.ReceivedAt}</td>
                    <td style={{ padding: "0.3rem" }}>
                      <Badge
                        tone={
                          l.Severity === "critical" || l.Severity === "error"
                            ? "danger"
                            : l.Severity === "warning"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {l.Severity ?? l.LogSource}
                      </Badge>
                    </td>
                    <td style={{ padding: "0.3rem", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.Message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Link href={`/dashboard/servers/${deviceId}/logs?source=eventlog`} style={{ color: "var(--primary)", fontSize: "0.8rem" }}>
            {isLinux ? "View all system log / reboot entries →" : "View all Event Viewer / reboot entries →"}
          </Link>
        </Card>

        {device.IisDetected && (
          <>
            <Card className="flex flex-col gap-2">
              <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>IIS Overview</h3>
              <p style={{ color: "var(--ink-muted)", fontSize: "0.74rem", margin: 0 }}>
                {iisAppPools.length} application pool(s) · {iisSites.length} site(s) · {iisWorkerProcesses.length} worker process(es)
              </p>
              {!iisPerf ? (
                <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No IIS perf counter data synced yet.</p>
              ) : (
                <dl style={{ margin: 0, fontSize: "0.82rem" }}>
                  {[
                    ["Web Service Requests/sec", iisPerf.WebServiceRequestsPerSec != null ? iisPerf.WebServiceRequestsPerSec.toFixed(1) : "—"],
                    ["Current Connections", iisPerf.CurrentConnections ?? "—"],
                    ["ASP.NET Requests/sec", iisPerf.AspNetRequestsPerSec != null ? iisPerf.AspNetRequestsPerSec.toFixed(1) : "—"],
                    ["Failed Request Traces (last 10min)", iisPerf.FailedRequestTraceCount ?? "—"],
                    ["Last Sample", iisPerf.ReceivedAt ?? "—"],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                      <dt style={{ color: "var(--ink-muted)" }}>{label}</dt>
                      <dd style={{ margin: 0 }}>{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </Card>

            <Card className="flex flex-col gap-2">
              <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Application Pools</h3>
              {iisAppPools.length === 0 ? (
                <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No app pool data synced yet.</p>
              ) : (
                <div style={{ maxHeight: 280, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                        <th style={{ padding: "0.3rem" }}>Name</th>
                        <th style={{ padding: "0.3rem" }}>State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {iisAppPools.map((p) => (
                        <tr key={p.Name}>
                          <td style={{ padding: "0.3rem" }}>{p.Name}</td>
                          <td style={{ padding: "0.3rem" }}>
                            <Badge tone={p.State === "Started" ? "success" : p.State === "Stopped" ? "neutral" : "warning"}>{p.State}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="flex flex-col gap-2">
              <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Websites</h3>
              <p style={{ color: "var(--ink-muted)", fontSize: "0.74rem", margin: 0 }}>
                Availability, status code, and response time from a local probe of each site&apos;s binding; SSL expiry read directly from the
                bound certificate.
              </p>
              {iisSites.length === 0 ? (
                <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No site data synced yet.</p>
              ) : (
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                        <th style={{ padding: "0.3rem" }}>Site</th>
                        <th style={{ padding: "0.3rem" }}>State</th>
                        <th style={{ padding: "0.3rem" }}>Availability</th>
                        <th style={{ padding: "0.3rem" }}>Status</th>
                        <th style={{ padding: "0.3rem" }}>Response</th>
                        <th style={{ padding: "0.3rem" }}>SSL Expires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {iisSites.map((s) => {
                        const sslSoon = s.SslExpiresAt && new Date(s.SslExpiresAt).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
                        return (
                          <tr key={s.SiteName}>
                            <td style={{ padding: "0.3rem" }}>{s.SiteName}</td>
                            <td style={{ padding: "0.3rem" }}>
                              <Badge tone={s.State === "Started" ? "success" : "neutral"}>{s.State}</Badge>
                            </td>
                            <td style={{ padding: "0.3rem" }}>
                              <Badge tone={s.IsAvailable ? "success" : "danger"}>{s.IsAvailable ? "Up" : "Down"}</Badge>
                            </td>
                            <td style={{ padding: "0.3rem" }}>{s.LastStatusCode ?? "—"}</td>
                            <td style={{ padding: "0.3rem" }}>{s.LastResponseTimeMs != null ? `${s.LastResponseTimeMs.toFixed(0)} ms` : "—"}</td>
                            <td style={{ padding: "0.3rem" }}>
                              {s.SslExpiresAt ? <Badge tone={sslSoon ? "warning" : "success"}>{s.SslExpiresAt}</Badge> : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="flex flex-col gap-2">
              <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Worker Processes (w3wp.exe)</h3>
              {iisWorkerProcesses.length === 0 ? (
                <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No worker process data synced yet.</p>
              ) : (
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                        <th style={{ padding: "0.3rem" }}>PID</th>
                        <th style={{ padding: "0.3rem" }}>App Pool</th>
                        <th style={{ padding: "0.3rem" }}>Private Bytes</th>
                        <th style={{ padding: "0.3rem" }}>CPU</th>
                      </tr>
                    </thead>
                    <tbody>
                      {iisWorkerProcesses.map((w) => (
                        <tr key={w.ProcessId}>
                          <td style={{ padding: "0.3rem" }}>{w.ProcessId}</td>
                          <td style={{ padding: "0.3rem" }}>{w.AppPoolName ?? "—"}</td>
                          <td style={{ padding: "0.3rem" }}>{w.PrivateBytesMB != null ? `${w.PrivateBytesMB.toFixed(1)} MB` : "—"}</td>
                          <td style={{ padding: "0.3rem" }}>{w.CpuPercent != null ? `${w.CpuPercent.toFixed(1)}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}

        {device.LinuxSecurityDetected && (
          <>
            <Card className="flex flex-col gap-2">
              <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Server Security — SSH &amp; Firewall</h3>
              {!linuxSecurity ? (
                <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No security data synced yet.</p>
              ) : (
                <dl style={{ margin: 0, fontSize: "0.82rem" }}>
                  <div className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>SSH Port</dt>
                    <dd style={{ margin: 0 }}>{linuxSecurity.SshPort ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>Root Login</dt>
                    <dd style={{ margin: 0 }}>
                      <Badge tone={linuxSecurity.SshPermitRootLogin === "yes" ? "danger" : linuxSecurity.SshPermitRootLogin ? "success" : "neutral"}>
                        {linuxSecurity.SshPermitRootLogin ?? "unknown"}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>Password Authentication</dt>
                    <dd style={{ margin: 0 }}>
                      <Badge tone={linuxSecurity.SshPasswordAuthentication === "yes" ? "warning" : linuxSecurity.SshPasswordAuthentication ? "success" : "neutral"}>
                        {linuxSecurity.SshPasswordAuthentication ?? "unknown"}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>SSH Service</dt>
                    <dd style={{ margin: 0 }}>
                      {linuxSecurity.SshServiceActive === null ? "—" : <Badge tone={linuxSecurity.SshServiceActive ? "success" : "danger"}>{linuxSecurity.SshServiceActive ? "Active" : "Inactive"}</Badge>}
                    </dd>
                  </div>
                  <div className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>Firewall</dt>
                    <dd style={{ margin: 0 }}>{linuxSecurity.FirewallType ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>Firewall Status</dt>
                    <dd style={{ margin: 0 }}>
                      {linuxSecurity.FirewallActive === null ? (
                        "—"
                      ) : (
                        <Badge tone={linuxSecurity.FirewallActive ? "success" : "danger"}>{linuxSecurity.FirewallActive ? "Active" : "Inactive"}</Badge>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>Firewall Rules</dt>
                    <dd style={{ margin: 0 }}>{linuxSecurity.FirewallRuleCount ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between" style={{ padding: "0.25rem 0" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>Last Synced</dt>
                    <dd style={{ margin: 0 }}>{linuxSecurity.UpdatedAt ?? "—"}</dd>
                  </div>
                </dl>
              )}
            </Card>

            <Card className="flex flex-col gap-2">
              <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>SELinux &amp; AppArmor</h3>
              {!linuxSecurity ? (
                <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No security data synced yet.</p>
              ) : (
                <dl style={{ margin: 0, fontSize: "0.82rem" }}>
                  <div className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>SELinux</dt>
                    <dd style={{ margin: 0 }}>
                      <Badge
                        tone={
                          linuxSecurity.SelinuxStatus === "Enforcing"
                            ? "success"
                            : linuxSecurity.SelinuxStatus === "Permissive"
                              ? "warning"
                              : linuxSecurity.SelinuxStatus === "Disabled"
                                ? "danger"
                                : "neutral"
                        }
                      >
                        {linuxSecurity.SelinuxStatus ?? "Unknown"}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>AppArmor</dt>
                    <dd style={{ margin: 0 }}>
                      <Badge tone={linuxSecurity.ApparmorStatus === "Active" ? "success" : "neutral"}>{linuxSecurity.ApparmorStatus ?? "Unknown"}</Badge>
                    </dd>
                  </div>
                  {linuxSecurity.ApparmorStatus === "Active" && (
                    <>
                      <div className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                        <dt style={{ color: "var(--ink-muted)" }}>Profiles Enforced</dt>
                        <dd style={{ margin: 0 }}>{linuxSecurity.ApparmorEnforceCount ?? "—"}</dd>
                      </div>
                      <div className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                        <dt style={{ color: "var(--ink-muted)" }}>Profiles in Complain Mode</dt>
                        <dd style={{ margin: 0 }}>{linuxSecurity.ApparmorComplainCount ?? "—"}</dd>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>Fail2Ban</dt>
                    <dd style={{ margin: 0 }}>
                      {linuxSecurity.Fail2banInstalled === false ? (
                        <Badge tone="neutral">Not Installed</Badge>
                      ) : (
                        <Badge tone={linuxSecurity.Fail2banActive ? "success" : "danger"}>{linuxSecurity.Fail2banActive ? "Active" : "Inactive"}</Badge>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>World-Writable Files</dt>
                    <dd style={{ margin: 0 }}>
                      <Badge tone={(linuxSecurity.WorldWritableFileCount ?? 0) > 0 ? "warning" : "success"}>{linuxSecurity.WorldWritableFileCount ?? 0}</Badge>
                    </dd>
                  </div>
                  <div className="flex justify-between" style={{ padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>SUID Binaries</dt>
                    <dd style={{ margin: 0 }}>{linuxSecurity.SuidBinaryCount ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between" style={{ padding: "0.25rem 0" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>Sudo NOPASSWD Entries</dt>
                    <dd style={{ margin: 0 }}>
                      <Badge tone={(linuxSecurity.SudoNopasswdCount ?? 0) > 0 ? "warning" : "success"}>{linuxSecurity.SudoNopasswdCount ?? 0}</Badge>
                    </dd>
                  </div>
                </dl>
              )}
            </Card>

            <Card className="flex flex-col gap-2">
              <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Open Ports</h3>
              {linuxOpenPorts.length === 0 ? (
                <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No listening ports synced yet.</p>
              ) : (
                <div style={{ maxHeight: 280, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                        <th style={{ padding: "0.3rem" }}>Port</th>
                        <th style={{ padding: "0.3rem" }}>Protocol</th>
                        <th style={{ padding: "0.3rem" }}>Address</th>
                        <th style={{ padding: "0.3rem" }}>Process</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linuxOpenPorts.map((p, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: "0.3rem" }}>{p.Port}</td>
                          <td style={{ padding: "0.3rem" }}>{p.Protocol}</td>
                          <td style={{ padding: "0.3rem", fontFamily: "monospace" }}>{p.Address}</td>
                          <td style={{ padding: "0.3rem" }}>{p.ProcessName ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {linuxSecurity?.Fail2banInstalled && (
              <Card className="flex flex-col gap-2">
                <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Fail2Ban Jails</h3>
                {linuxFail2banJails.length === 0 ? (
                  <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No jails configured/synced yet.</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                        <th style={{ padding: "0.3rem" }}>Jail</th>
                        <th style={{ padding: "0.3rem" }}>Currently Banned</th>
                        <th style={{ padding: "0.3rem" }}>Total Banned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linuxFail2banJails.map((j) => (
                        <tr key={j.JailName}>
                          <td style={{ padding: "0.3rem" }}>{j.JailName}</td>
                          <td style={{ padding: "0.3rem" }}>
                            <Badge tone={j.CurrentlyBanned > 0 ? "warning" : "success"}>{j.CurrentlyBanned}</Badge>
                          </td>
                          <td style={{ padding: "0.3rem" }}>{j.TotalBanned}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            )}

            <Card className="flex flex-col gap-2">
              <h3 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Permissions &amp; Sudo</h3>
              <p style={{ color: "var(--ink-muted)", fontSize: "0.74rem", margin: 0 }}>
                World-writable files scoped to /etc, /var/www, /home, /opt; SUID binaries scanned system-wide. Showing up to 20 samples of each and
                up to 30 sudoers NOPASSWD entries.
              </p>
              {linuxWorldWritable.length > 0 && (
                <>
                  <dt style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: "0.25rem" }}>World-Writable Files</dt>
                  <div style={{ maxHeight: 120, overflowY: "auto", fontFamily: "monospace", fontSize: "0.74rem" }}>
                    {linuxWorldWritable.map((r, idx) => (
                      <div key={idx} style={{ padding: "0.15rem 0" }}>
                        {r.Path}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {linuxSuidBinaries.length > 0 && (
                <>
                  <dt style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: "0.25rem" }}>SUID Binaries</dt>
                  <div style={{ maxHeight: 120, overflowY: "auto", fontFamily: "monospace", fontSize: "0.74rem" }}>
                    {linuxSuidBinaries.map((r, idx) => (
                      <div key={idx} style={{ padding: "0.15rem 0" }}>
                        {r.Path}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {linuxSudoEntries.length > 0 && (
                <>
                  <dt style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: "0.25rem" }}>Sudo NOPASSWD Entries</dt>
                  <div style={{ maxHeight: 140, overflowY: "auto", fontFamily: "monospace", fontSize: "0.74rem" }}>
                    {linuxSudoEntries.map((r, idx) => (
                      <div key={idx} style={{ padding: "0.15rem 0" }}>
                        {r.Entry}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {linuxWorldWritable.length === 0 && linuxSuidBinaries.length === 0 && linuxSudoEntries.length === 0 && (
                <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No permission/sudo data synced yet.</p>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
