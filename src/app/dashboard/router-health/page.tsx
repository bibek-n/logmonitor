import { getDb, sql } from "@/lib/db";
import BandwidthChart from "@/components/BandwidthChart";

export const dynamic = "force-dynamic";

interface HealthRow {
  Id: number;
  ReceivedAt: string;
  UptimeSeconds: number | null;
  Version: string | null;
  BoardName: string | null;
  CpuLoadPct: number | null;
  CpuCount: number | null;
  CpuFrequencyMhz: number | null;
  FreeMemoryMB: number | null;
  TotalMemoryMB: number | null;
  FreeDiskMB: number | null;
  TotalDiskMB: number | null;
  Temperature: number | null;
  Voltage: number | null;
}

interface InterfaceRow {
  Name: string;
  Type: string | null;
  Running: boolean;
  Disabled: boolean;
  Slave: boolean;
  MacAddress: string | null;
  Comment: string | null;
  LastLinkUpTime: string | null;
  LastLinkDownTime: string | null;
  LinkDowns: number | null;
}

interface BandwidthRow {
  ReceivedAt: string;
  RxMbps: number | null;
  TxMbps: number | null;
}

async function bandwidthPoints(iface: string) {
  const db = await getDb();
  const result = await db
    .request()
    .input("iface", sql.NVarChar, iface)
    .query<BandwidthRow>(`
      SELECT TOP 50 ReceivedAt, RxMbps, TxMbps
      FROM RouterBandwidth
      WHERE Interface = @iface
      ORDER BY ReceivedAt DESC
    `);
  return result.recordset
    .filter((r) => r.RxMbps !== null && r.TxMbps !== null)
    .map((r) => ({ t: r.ReceivedAt, rx: Number(r.RxMbps), tx: Number(r.TxMbps) }))
    .reverse();
}

interface ActiveUserRow {
  Id: number;
  Name: string;
  Address: string | null;
  Via: string | null;
  LoginTime: string | null;
}

// Includes seconds (not just d/h/m) — at a 30s poll interval, a coarser format shows
// the exact same string for many consecutive rows in a row, which reads as static/fake
// even though the underlying value is genuinely ticking upward every cycle.
function formatUptime(seconds: number | null): string {
  if (seconds == null) return "-";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m ${secs}s`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatUpSince(seconds: number | null, asOf: string | null): string {
  if (seconds == null || !asOf) return "-";
  const since = new Date(new Date(asOf).getTime() - seconds * 1000);
  return since.toLocaleString();
}

function StatTile({ label, value, status }: { label: string; value: string | number; status: string }) {
  return (
    <div className={`stat-tile status-${status}`}>
      <div className="label">
        <span className={`status-dot status-${status}`} />
        {label}
      </div>
      <div className="value">{value}</div>
    </div>
  );
}

function pctStatus(pct: number | null, warnAt: number, criticalAt: number): string {
  if (pct === null) return "unknown";
  if (pct >= criticalAt) return "critical";
  if (pct >= warnAt) return "warning";
  return "good";
}

export default async function RouterHealthPage() {
  const db = await getDb();

  const latestResult = await db.query<HealthRow>("SELECT TOP 1 * FROM RouterHealth ORDER BY ReceivedAt DESC");
  const latest = latestResult.recordset[0] ?? null;

  const interfacesResult = await db.query<InterfaceRow>(
    "SELECT Name, Type, Running, Disabled, Slave, MacAddress, Comment, LastLinkUpTime, LastLinkDownTime, LinkDowns FROM RouterInterfaces ORDER BY Name"
  );
  const interfaces = interfacesResult.recordset;

  const interfaceBandwidth = await Promise.all(
    interfaces.map(async (i) => ({ name: i.Name, points: await bandwidthPoints(i.Name) }))
  );

  const activeUsersResult = await db.query<ActiveUserRow>(
    "SELECT Id, Name, Address, Via, LoginTime FROM RouterActiveUsers ORDER BY LoginTime DESC"
  );
  const activeUsers = activeUsersResult.recordset;

  const memUsedPct =
    latest?.FreeMemoryMB != null && latest?.TotalMemoryMB
      ? ((latest.TotalMemoryMB - latest.FreeMemoryMB) / latest.TotalMemoryMB) * 100
      : null;
  const diskUsedPct =
    latest?.FreeDiskMB != null && latest?.TotalDiskMB
      ? ((latest.TotalDiskMB - latest.FreeDiskMB) / latest.TotalDiskMB) * 100
      : null;

  return (
    <div>
      <h1>Router Health</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        MikroTik 10.20.20.2 &middot; {latest?.BoardName ?? "unknown board"} &middot; RouterOS {latest?.Version ?? "-"}
      </p>

      {!latest ? (
        <div className="dash-panel">
          <p style={{ color: "var(--ink-muted)" }}>No router health data yet — waiting for the next poll cycle.</p>
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <StatTile label="CPU Load" value={latest.CpuLoadPct != null ? `${latest.CpuLoadPct.toFixed(0)}%` : "-"} status={pctStatus(latest.CpuLoadPct, 70, 90)} />
            <StatTile
              label="Memory Used"
              value={memUsedPct != null ? `${memUsedPct.toFixed(0)}%` : "-"}
              status={pctStatus(memUsedPct, 75, 90)}
            />
            <StatTile
              label="Disk Used"
              value={diskUsedPct != null ? `${diskUsedPct.toFixed(0)}%` : "-"}
              status={pctStatus(diskUsedPct, 75, 90)}
            />
            <StatTile label="Uptime" value={formatUptime(latest.UptimeSeconds)} status="unknown" />
            <StatTile
              label="Temperature"
              value={latest.Temperature != null ? `${latest.Temperature.toFixed(0)}°C` : "n/a"}
              status={latest.Temperature != null ? pctStatus(latest.Temperature, 60, 75) : "unknown"}
            />
            <StatTile label="Voltage" value={latest.Voltage != null ? `${latest.Voltage.toFixed(1)}V` : "n/a"} status="unknown" />
          </div>

          <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>
            {latest.CpuCount ?? "?"} CPU cores @ {latest.CpuFrequencyMhz ?? "?"} MHz &middot;{" "}
            {latest.TotalMemoryMB != null ? `${(latest.TotalMemoryMB / 1024).toFixed(2)} GB RAM` : ""} &middot;{" "}
            {latest.TotalDiskMB != null ? `${(latest.TotalDiskMB / 1024).toFixed(2)} GB storage` : ""} &middot; up since{" "}
            {formatUpSince(latest.UptimeSeconds, latest.ReceivedAt)}
          </p>

          <div className="dash-panel">
            <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.75rem" }}>Bandwidth</h2>
            {interfaceBandwidth.every((b) => b.points.length < 2) ? (
              <p style={{ color: "var(--ink-muted)" }}>
                Not enough data yet to draw bandwidth charts — check back after a few more poll cycles.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                {interfaceBandwidth.map(({ name, points }) => (
                  <div key={name}>
                    <h3 style={{ fontSize: "0.85rem", marginTop: 0, marginBottom: "0.35rem", color: "var(--ink-secondary)" }}>
                      {name}
                    </h3>
                    <BandwidthChart points={points} unit="Mbps" height={140} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="dash-panel">
            <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.75rem" }}>Interfaces</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.4rem" }}>Name</th>
                    <th style={{ padding: "0.4rem" }}>Type</th>
                    <th style={{ padding: "0.4rem" }}>Status</th>
                    <th style={{ padding: "0.4rem" }}>MAC Address</th>
                    <th style={{ padding: "0.4rem" }}>Last Up</th>
                    <th style={{ padding: "0.4rem" }}>Last Down</th>
                    <th style={{ padding: "0.4rem" }}>Link Downs</th>
                    <th style={{ padding: "0.4rem" }}>Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {interfaces.map((i) => {
                    const status = i.Disabled ? "unknown" : i.Running ? "good" : "warning";
                    return (
                      <tr key={i.Name} style={{ borderBottom: "1px solid var(--grid)" }}>
                        <td style={{ padding: "0.4rem" }}>
                          {i.Name}
                          {i.Slave && <span style={{ color: "var(--ink-muted)", fontSize: "0.72rem" }}> (slave)</span>}
                        </td>
                        <td style={{ padding: "0.4rem" }}>{i.Type ?? "-"}</td>
                        <td style={{ padding: "0.4rem" }}>
                          <span className={`status-dot status-${status}`} style={{ marginRight: "0.4rem" }} />
                          {i.Disabled ? "Disabled" : i.Running ? "Running" : "Down"}
                        </td>
                        <td style={{ padding: "0.4rem" }}>{i.MacAddress ?? "-"}</td>
                        <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                          {i.LastLinkUpTime ? new Date(i.LastLinkUpTime).toLocaleString() : "-"}
                        </td>
                        <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                          {i.LastLinkDownTime ? new Date(i.LastLinkDownTime).toLocaleString() : "-"}
                        </td>
                        <td style={{ padding: "0.4rem" }}>{i.LinkDowns ?? "-"}</td>
                        <td style={{ padding: "0.4rem" }}>{i.Comment ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="dash-panel">
            <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.75rem" }}>Active Router Sessions</h2>
            <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 0 }}>
              Who&apos;s currently logged into the router itself (admin/SSH/API/Winbox) — distinct from DHCP clients.
            </p>
            {activeUsers.length === 0 ? (
              <p style={{ color: "var(--ink-muted)" }}>No active sessions.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.4rem" }}>User</th>
                    <th style={{ padding: "0.4rem" }}>Address</th>
                    <th style={{ padding: "0.4rem" }}>Via</th>
                    <th style={{ padding: "0.4rem" }}>Since</th>
                  </tr>
                </thead>
                <tbody>
                  {activeUsers.map((u) => (
                    <tr key={u.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem" }}>{u.Name}</td>
                      <td style={{ padding: "0.4rem" }}>{u.Address ?? "-"}</td>
                      <td style={{ padding: "0.4rem" }}>{u.Via ?? "-"}</td>
                      <td style={{ padding: "0.4rem" }}>{u.LoginTime ? new Date(u.LoginTime).toLocaleString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
