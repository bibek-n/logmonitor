import { getDb } from "@/lib/db";

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

function formatUptime(seconds: number | null): string {
  if (seconds == null) return "-";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
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

  const historyResult = await db.query<HealthRow>("SELECT TOP 100 * FROM RouterHealth ORDER BY ReceivedAt DESC");
  const history = historyResult.recordset;

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
            {latest.TotalDiskMB != null ? `${(latest.TotalDiskMB / 1024).toFixed(2)} GB storage` : ""}
          </p>

          <div className="dash-panel">
            <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.75rem" }}>Recent History</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.4rem" }}>Time</th>
                    <th style={{ padding: "0.4rem" }}>CPU</th>
                    <th style={{ padding: "0.4rem" }}>Memory Used</th>
                    <th style={{ padding: "0.4rem" }}>Disk Used</th>
                    <th style={{ padding: "0.4rem" }}>Temp</th>
                    <th style={{ padding: "0.4rem" }}>Voltage</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => {
                    const rMem =
                      r.FreeMemoryMB != null && r.TotalMemoryMB ? ((r.TotalMemoryMB - r.FreeMemoryMB) / r.TotalMemoryMB) * 100 : null;
                    const rDisk =
                      r.FreeDiskMB != null && r.TotalDiskMB ? ((r.TotalDiskMB - r.FreeDiskMB) / r.TotalDiskMB) * 100 : null;
                    return (
                      <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                        <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(r.ReceivedAt).toLocaleString()}</td>
                        <td style={{ padding: "0.4rem" }}>{r.CpuLoadPct != null ? `${r.CpuLoadPct.toFixed(0)}%` : "-"}</td>
                        <td style={{ padding: "0.4rem" }}>{rMem != null ? `${rMem.toFixed(0)}%` : "-"}</td>
                        <td style={{ padding: "0.4rem" }}>{rDisk != null ? `${rDisk.toFixed(0)}%` : "-"}</td>
                        <td style={{ padding: "0.4rem" }}>{r.Temperature != null ? `${r.Temperature.toFixed(0)}°C` : "n/a"}</td>
                        <td style={{ padding: "0.4rem" }}>{r.Voltage != null ? `${r.Voltage.toFixed(1)}V` : "n/a"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
