import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FileText } from "lucide-react";

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
        CONVERT(VARCHAR(19), EnrolledAt, 126) AS EnrolledAt
      FROM Devices WHERE DeviceId = @deviceId AND DeviceType = 'Server'
    `);
  const device = deviceResult.recordset[0];
  if (!device) notFound();

  const [hardwareResult, disksResult, interfacesResult, logCountResult] = await Promise.all([
    db.request().input("deviceId", sql.VarChar, deviceId).query(`
      SELECT CpuModel, CpuManufacturer, CpuCores, CpuThreads, CpuClockMhz, MemoryTotalMB,
        MotherboardManufacturer, MotherboardModel, BiosManufacturer, BiosReleaseDate,
        OsEdition, OsBuild, KernelVersion, Architecture, CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
      FROM DeviceHardwareInfo WHERE DeviceId = @deviceId
    `),
    db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT DiskIndex, Model, Type, CapacityGB FROM DeviceDisks WHERE DeviceId = @deviceId ORDER BY DiskIndex ASC"),
    db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT InterfaceName, MacAddress, IpAddresses, IsUp, SpeedMbps FROM DeviceNetworkInterfaces WHERE DeviceId = @deviceId"),
    db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT COUNT(*) AS Cnt FROM ServerLogEntries WHERE DeviceId = @deviceId"),
  ]);
  const hw = hardwareResult.recordset[0];
  const disks = disksResult.recordset;
  const interfaces = interfacesResult.recordset;
  const logCount = logCountResult.recordset[0]?.Cnt ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: "0.25rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>{device.DeviceName ?? device.Hostname}</h1>
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[device.LifecycleStatus] ?? "neutral"}>{device.LifecycleStatus}</Badge>
          <Badge tone={isOnline(device.LastHeartbeat) ? "success" : "neutral"}>{isOnline(device.LastHeartbeat) ? "Online" : "Offline"}</Badge>
        </div>
      </div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        {device.Hostname} · {device.ServerRole ?? "No role set"} ·{" "}
        <Link href={`/dashboard/servers/${deviceId}/logs`} style={{ color: "var(--primary)" }}>
          <FileText size={12} style={{ display: "inline", marginRight: 4 }} />
          View Logs ({logCount})
        </Link>
      </p>

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
                </tr>
              </thead>
              <tbody>
                {disks.map((d) => (
                  <tr key={d.DiskIndex}>
                    <td style={{ padding: "0.3rem" }}>{d.DiskIndex}</td>
                    <td style={{ padding: "0.3rem" }}>{d.Model ?? "—"}</td>
                    <td style={{ padding: "0.3rem" }}>{d.Type ?? "—"}</td>
                    <td style={{ padding: "0.3rem" }}>{d.CapacityGB ? `${d.CapacityGB.toFixed(0)} GB` : "—"}</td>
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
      </div>
    </div>
  );
}
