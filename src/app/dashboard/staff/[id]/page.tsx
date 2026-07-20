import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb, sql } from "@/lib/db";
import { parseRouterDurationToSeconds } from "@/lib/mikrotikParser";
import { classifyDevice } from "@/lib/deviceType";
import { formatDuration } from "@/lib/staffStatus";
import { parseJsonArray } from "@/lib/parseJsonArray";
import { Avatar } from "@/components/ui/Avatar";
import { DeviceReportToggle } from "@/components/staff/DeviceReportToggle";
import type {
  HardwareInfo,
  DiskRow,
  DiskSpace,
  VolumeRow,
  SecurityStatus,
  NetworkInfo,
  ProcessRow,
  ServiceRow,
  SoftwareRow,
  DeviceAlertRow,
  UsbEventRow,
} from "@/components/endpointAgents/DeviceDetail";

export const dynamic = "force-dynamic";

interface StaffRow {
  Id: number;
  Name: string;
  MacAddress: string | null;
  ComputerNameOverride: string | null;
  Email: string | null;
  Phone: string | null;
  Department: string | null;
  Position: string | null;
  Address: string | null;
  PhotoPath: string | null;
  RouterIp: string | null;
  Hostname: string | null;
  Status: string | null;
  LastSeenRaw: string | null;
  RouterUpdatedAt: string | null;
  Os: string | null;
  RouterFirstSeen: string | null;
  SophosIp: string | null;
  SophosUpdatedAt: string | null;
  SophosHostname: string | null;
  SophosOs: string | null;
  SophosFirstSeen: string | null;
  VendorName: string | null;
}

interface LinkedDevice {
  DeviceId: string;
  Hostname: string;
  OS: string;
  LastHeartbeat: string | null;
}

interface HistoricalIp {
  IpAddress: string;
  Source: "mikrotik" | "sophos";
  UpdatedAt: string;
}

function isPollFresh(updatedAt: string | null, staleMinutes = 10): boolean {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() <= staleMinutes * 60 * 1000;
}

function lastSeenAt(updatedAt: string | null, lastSeenRaw: string | null): Date | null {
  if (!updatedAt) return null;
  const seconds = parseRouterDurationToSeconds(lastSeenRaw);
  if (seconds === null) return null;
  return new Date(new Date(updatedAt).getTime() - seconds * 1000);
}

interface WebFilterRow {
  Id: number;
  ReceivedAt: string;
  SrcIp: string;
  Domain: string | null;
  Url: string | null;
  Category: string | null;
  Action: string | null;
}

interface RouterWebRow {
  Id: number;
  ReceivedAt: string;
  SrcIp: string;
  DstIp: string | null;
  DstPort: number | null;
  ReverseDns: string | null;
}

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staffId = Number(id);
  if (!staffId) notFound();

  const t = await getTranslations("employees.detail");
  const db = await getDb();

  const staffResult = await db
    .request()
    .input("id", sql.Int, staffId)
    .query<StaffRow>(`
      SELECT s.Id, s.Name, s.MacAddress, s.ComputerNameOverride, s.Email, s.Phone, s.Department, s.Position, s.Address, s.PhotoPath,
        best.IpAddress AS RouterIp, best.Hostname, best.Status, best.LastSeenRaw, best.UpdatedAt AS RouterUpdatedAt, best.Os,
        best.FirstSeen AS RouterFirstSeen,
        sophosBest.IpAddress AS SophosIp, sophosBest.UpdatedAt AS SophosUpdatedAt, sophosBest.Hostname AS SophosHostname,
        sophosBest.Os AS SophosOs, sophosBest.FirstSeen AS SophosFirstSeen,
        ov.VendorName
      FROM Staff s
      OUTER APPLY (
        SELECT TOP 1 IpAddress, Hostname, Status, LastSeenRaw, UpdatedAt, Os, FirstSeen
        FROM RouterClients rc WHERE UPPER(rc.MacAddress) = UPPER(s.MacAddress)
        ORDER BY UpdatedAt DESC
      ) best
      OUTER APPLY (
        SELECT TOP 1 IpAddress, UpdatedAt, Hostname, Os, FirstSeen
        FROM SophosClients sc WHERE UPPER(sc.MacAddress) = UPPER(s.MacAddress)
        ORDER BY UpdatedAt DESC
      ) sophosBest
      LEFT JOIN OuiVendors ov ON ov.Prefix = REPLACE(LEFT(s.MacAddress, 8), ':', '')
      WHERE s.Id = @id
    `);

  const staffMember = staffResult.recordset[0];
  if (!staffMember) notFound();

  const routerTime = staffMember.RouterIp && staffMember.RouterUpdatedAt ? new Date(staffMember.RouterUpdatedAt).getTime() : -Infinity;
  const sophosTime = staffMember.SophosIp && staffMember.SophosUpdatedAt ? new Date(staffMember.SophosUpdatedAt).getTime() : -Infinity;
  const source: "mikrotik" | "sophos" | null =
    routerTime === -Infinity && sophosTime === -Infinity ? null : routerTime >= sophosTime ? "mikrotik" : "sophos";
  const currentIp = source === "mikrotik" ? staffMember.RouterIp : source === "sophos" ? staffMember.SophosIp : null;
  // Classification stays driven by the network-reported hostname even when an admin has
  // overridden the displayed name — see the matching comment in getStaffWithStatus.
  const autoDeviceName = source === "mikrotik" ? staffMember.Hostname : source === "sophos" ? staffMember.SophosHostname : null;
  const deviceName = staffMember.ComputerNameOverride ?? autoDeviceName;
  const os = source === "mikrotik" ? staffMember.Os : source === "sophos" ? staffMember.SophosOs : null;
  const firstSeenRaw = source === "mikrotik" ? staffMember.RouterFirstSeen : source === "sophos" ? staffMember.SophosFirstSeen : null;
  const firstSeen = firstSeenRaw ? new Date(firstSeenRaw) : null;
  const deviceType = classifyDevice(autoDeviceName, staffMember.VendorName);

  let isOnline = false;
  if (source === "mikrotik") {
    isOnline = !!staffMember.MacAddress && staffMember.Status === "bound" && isPollFresh(staffMember.RouterUpdatedAt);
  } else if (source === "sophos" && currentIp) {
    const activeResult = await db
      .request()
      .input("ip", sql.VarChar, currentIp)
      .query<{ Cnt: number }>(`
        SELECT COUNT(*) AS Cnt FROM WebFilterLogs WHERE SrcIp = @ip AND ReceivedAt >= DATEADD(MINUTE, -10, SYSUTCDATETIME())
      `);
    isOnline = activeResult.recordset[0].Cnt > 0;
  }

  // Reverse-lookup of the existing, already-working Devices.StaffId link (set from the
  // Endpoint Agents device's own "Assigned staff member" field) — surfaced here purely for
  // visibility, not re-editable from this page, so there's only one place that writes it.
  const linkedDeviceResult = await db
    .request()
    .input("id", sql.Int, staffId)
    .query<LinkedDevice>(
      "SELECT DeviceId, Hostname, OS, LastHeartbeat FROM Devices WHERE StaffId = @id"
    );
  const linkedDevice = linkedDeviceResult.recordset[0] ?? null;

  // Full device report, fetched only when a PC is actually linked - same queries as the
  // Endpoint Agents detail page, reused here so an admin doesn't have to leave this page to
  // see CPU/RAM/disk health/security/etc. for this specific employee's machine.
  let latestMetrics: { cpuPct: number | null; memPct: number | null; diskPct: number | null } | null = null;
  let deviceHardware: HardwareInfo | null = null;
  let deviceDisks: DiskRow[] = [];
  let deviceDiskSpace: DiskSpace | null = null;
  let deviceVolumes: VolumeRow[] = [];
  let deviceSecurity: SecurityStatus | null = null;
  let deviceNetwork: NetworkInfo | null = null;
  let deviceProcesses: ProcessRow[] = [];
  let deviceServices: ServiceRow[] = [];
  let deviceSoftware: SoftwareRow[] = [];
  let deviceAlerts: DeviceAlertRow[] = [];
  let deviceUsbEvents: UsbEventRow[] = [];

  if (linkedDevice) {
    const did = linkedDevice.DeviceId;
    const [metricsRes, hwRes, disksRes, diskSpaceRes, volumesRes, secRes, netRes, procRes, svcRes, swRes, alertsRes, usbRes] = await Promise.all([
      db.request().input("id", sql.VarChar, did).query<{ CpuPct: number | null; MemPct: number | null; DiskPct: number | null }>(
        "SELECT TOP 1 CpuPct, MemPct, DiskPct FROM DeviceMetrics WHERE DeviceId = @id ORDER BY ReceivedAt DESC"
      ),
      db.request().input("id", sql.VarChar, did).query<HardwareInfo>(`
        SELECT CpuModel AS cpuModel, CpuManufacturer AS cpuManufacturer, CpuCores AS cpuCores, CpuThreads AS cpuThreads,
          CpuClockMhz AS cpuClockMhz, MemoryTotalMB AS memoryTotalMB, DiskModel AS diskModel, DiskType AS diskType,
          DiskCapacityGB AS diskCapacityGB, GpuName AS gpuName, OsEdition AS osEdition, OsBuild AS osBuild,
          KernelVersion AS kernelVersion, Architecture AS architecture
        FROM DeviceHardwareInfo WHERE DeviceId = @id
      `),
      db.request().input("id", sql.VarChar, did).query<DiskRow>(`
        SELECT DiskIndex AS diskIndex, Model AS model, Type AS type, CapacityGB AS capacityGB,
          HealthStatus AS healthStatus, OperationalStatus AS operationalStatus, TemperatureCelsius AS temperatureCelsius
        FROM DeviceDisks WHERE DeviceId = @id ORDER BY DiskIndex ASC
      `),
      db.request().input("id", sql.VarChar, did).query<DiskSpace>(
        "SELECT TOP 1 DiskFreeGB AS freeGB, DiskTotalGB AS totalGB FROM DeviceMetrics WHERE DeviceId = @id ORDER BY ReceivedAt DESC"
      ),
      db.request().input("id", sql.VarChar, did).query<VolumeRow>(`
        SELECT MountPoint AS mountPoint, Device AS device, FsType AS fsType, TotalGB AS totalGB, FreeGB AS freeGB, UsedPercent AS usedPercent
        FROM DeviceVolumes WHERE DeviceId = @id ORDER BY MountPoint ASC
      `),
      db.request().input("id", sql.VarChar, did).query<SecurityStatus>(`
        SELECT AntivirusStatus AS antivirusStatus, DefenderStatus AS defenderStatus, FirewallEnabled AS firewallEnabled,
          FirewallRulesCount AS firewallRulesCount, BitLockerStatus AS bitLockerStatus, LuksStatus AS luksStatus,
          SecureBootEnabled AS secureBootEnabled, TpmVersion AS tpmVersion, SELinuxStatus AS selinuxStatus,
          AppArmorStatus AS apparmorStatus, FailedLoginCount24h AS failedLoginCount24h
        FROM DeviceSecurityStatus WHERE DeviceId = @id
      `),
      db.request().input("id", sql.VarChar, did).query<{
        currentIp: string | null; publicIp: string | null; gatewayIp: string | null; dnsServers: string | null;
        wifiSsid: string | null; vpnActive: boolean | null; ethernetConnected: boolean | null;
        openPortsJson: string | null; listeningPortsJson: string | null;
      }>(`
        SELECT CurrentIp AS currentIp, PublicIp AS publicIp, GatewayIp AS gatewayIp, DnsServers AS dnsServers,
          WifiSsid AS wifiSsid, VpnActive AS vpnActive, EthernetConnected AS ethernetConnected,
          OpenPortsJson AS openPortsJson, ListeningPortsJson AS listeningPortsJson
        FROM DeviceNetworkInfo WHERE DeviceId = @id
      `),
      db.request().input("id", sql.VarChar, did).query<{ ProcessesJson: string }>(
        "SELECT ProcessesJson FROM DeviceProcessSnapshot WHERE DeviceId = @id"
      ),
      db.request().input("id", sql.VarChar, did).query<{ ServicesJson: string }>(
        "SELECT ServicesJson FROM DeviceServiceSnapshot WHERE DeviceId = @id"
      ),
      db.request().input("id", sql.VarChar, did).query<{ SoftwareJson: string }>(
        "SELECT SoftwareJson FROM DeviceSoftwareSnapshot WHERE DeviceId = @id"
      ),
      db.request().input("id", sql.VarChar, did).query<DeviceAlertRow>(`
        SELECT TOP 20 Id AS id, AlertType AS alertType, Severity AS severity, Message AS message,
          TriggeredAt AS triggeredAt, ResolvedAt AS resolvedAt
        FROM DeviceAlerts WHERE DeviceId = @id ORDER BY TriggeredAt DESC
      `),
      db.request().input("id", sql.VarChar, did).query<UsbEventRow>(`
        SELECT TOP 20 EventType AS eventType, DeviceName AS deviceName, VendorId AS vendorId,
          VendorName AS vendorName, SerialNumber AS serialNumber,
          StorageCapacityGB AS storageCapacityGB, DetectedAt AS detectedAt
        FROM DeviceUsbEvents WHERE DeviceId = @id ORDER BY DetectedAt DESC
      `),
    ]);

    const m = metricsRes.recordset[0];
    latestMetrics = m ? { cpuPct: m.CpuPct, memPct: m.MemPct, diskPct: m.DiskPct } : null;
    deviceHardware = hwRes.recordset[0] ?? null;
    deviceDisks = disksRes.recordset;
    deviceDiskSpace = diskSpaceRes.recordset[0] ?? null;
    deviceVolumes = volumesRes.recordset;
    deviceSecurity = secRes.recordset[0] ?? null;
    const netRow = netRes.recordset[0];
    deviceNetwork = netRow
      ? { ...netRow, openPorts: parseJsonArray<number>(netRow.openPortsJson), listeningPorts: parseJsonArray<number>(netRow.listeningPortsJson) }
      : null;
    deviceProcesses = parseJsonArray<ProcessRow>(procRes.recordset[0]?.ProcessesJson);
    deviceServices = parseJsonArray<ServiceRow>(svcRes.recordset[0]?.ServicesJson);
    deviceSoftware = parseJsonArray<SoftwareRow>(swRes.recordset[0]?.SoftwareJson);
    deviceAlerts = alertsRes.recordset;
    deviceUsbEvents = usbRes.recordset;
  }

  const statusColor = !staffMember.MacAddress ? "unknown" : isOnline ? "good" : "critical";
  // MikroTik gives a precise "last seen X ago" from the lease; Sophos-side only tells us the
  // device was still in the firewall's ARP table as of its last poll — coarser, still useful.
  const seenAt =
    source === "mikrotik"
      ? lastSeenAt(staffMember.RouterUpdatedAt, staffMember.LastSeenRaw)
      : source === "sophos" && staffMember.SophosUpdatedAt
        ? new Date(staffMember.SophosUpdatedAt)
        : null;

  // Every IP this MAC has ever held, on either network — so the activity report below covers
  // the full history, not just whatever the device's IP happens to be right now.
  let historicalIps: HistoricalIp[] = [];
  if (staffMember.MacAddress) {
    const historyResult = await db
      .request()
      .input("mac", sql.VarChar, staffMember.MacAddress)
      .query<HistoricalIp>(`
        SELECT IpAddress, 'mikrotik' AS Source, UpdatedAt
        FROM RouterClients WHERE UPPER(MacAddress) = UPPER(@mac)
        UNION ALL
        SELECT IpAddress, 'sophos' AS Source, UpdatedAt
        FROM SophosClients WHERE UPPER(MacAddress) = UPPER(@mac)
        ORDER BY UpdatedAt DESC
      `);
    historicalIps = historyResult.recordset;
  }
  const allIps = [...new Set(historicalIps.map((h) => h.IpAddress))];

  let webFilterRows: WebFilterRow[] = [];
  let routerWebRows: RouterWebRow[] = [];
  if (allIps.length > 0) {
    const ipList = allIps.map((_, i) => `@ip${i}`).join(", ");
    const wfRequest = db.request();
    const rwRequest = db.request();
    allIps.forEach((ip, i) => {
      wfRequest.input(`ip${i}`, sql.VarChar, ip);
      rwRequest.input(`ip${i}`, sql.VarChar, ip);
    });

    const [webFilterResult, routerWebResult] = await Promise.all([
      wfRequest.query<WebFilterRow>(`
        SELECT TOP 50 Id, ReceivedAt, SrcIp, Domain, Url, Category, Action
        FROM WebFilterLogs WHERE SrcIp IN (${ipList}) ORDER BY ReceivedAt DESC
      `),
      rwRequest.query<RouterWebRow>(`
        SELECT TOP 50 Id, ReceivedAt, SrcIp, DstIp, DstPort, ReverseDns
        FROM RouterWebLogs WHERE SrcIp IN (${ipList}) ORDER BY ReceivedAt DESC
      `),
    ]);
    webFilterRows = webFilterResult.recordset;
    routerWebRows = routerWebResult.recordset;
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Avatar name={staffMember.Name} photoPath={staffMember.PhotoPath} size={48} />
        <h1 style={{ margin: 0 }}>{staffMember.Name}</h1>
      </div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
        <Link href="/dashboard/staff" style={{ color: "var(--series-1)" }}>
          &larr; {t("backToAllLink")}
        </Link>
      </p>

      <div className="dash-panel">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", fontSize: "0.85rem" }}>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>{t("emailLabel")}</span> {staffMember.Email ?? "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>{t("cellNumberLabel")}</span> {staffMember.Phone ?? "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>{t("departmentLabel")}</span> {staffMember.Department ?? "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>{t("positionLabel")}</span> {staffMember.Position ?? "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>{t("addressLabel")}</span> {staffMember.Address ?? "-"}
          </span>
        </div>
      </div>

      <div className="dash-panel">
        <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.5rem" }}>{t("assignedEndpointAgentTitle")}</h2>
        {linkedDevice ? (
          <div>
            <p style={{ fontSize: "0.85rem", margin: "0 0 0.75rem" }}>
              <Link href={`/dashboard/endpoint-agents/${linkedDevice.DeviceId}`} style={{ color: "var(--series-1)" }}>
                {linkedDevice.Hostname}
              </Link>{" "}
              <span style={{ color: "var(--ink-muted)" }}>
                ({linkedDevice.OS}) &middot; {t("lastHeartbeatLabel")}{" "}
                {linkedDevice.LastHeartbeat ? new Date(linkedDevice.LastHeartbeat).toLocaleString() : t("neverLabel")}
              </span>
            </p>
            <DeviceReportToggle
              latestMetrics={latestMetrics}
              hardware={deviceHardware}
              disks={deviceDisks}
              diskSpace={deviceDiskSpace}
              volumes={deviceVolumes}
              security={deviceSecurity}
              network={deviceNetwork}
              processes={deviceProcesses}
              services={deviceServices}
              software={deviceSoftware}
              alerts={deviceAlerts}
              usbEvents={deviceUsbEvents}
            />
          </div>
        ) : (
          <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>
            {t.rich("noPcLinkedNotice", {
              link: (chunks) => (
                <Link href="/dashboard/endpoint-agents" style={{ color: "var(--series-1)" }}>
                  {chunks}
                </Link>
              ),
            })}
          </p>
        )}
      </div>

      <div className="dash-panel">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", fontSize: "0.85rem" }}>
          <span>
            <span className={`status-dot status-${statusColor}`} style={{ marginRight: "0.4rem" }} />
            <span style={{ color: "var(--ink-muted)" }}>{t("statusLabel")}</span>{" "}
            {!staffMember.MacAddress ? t("noDeviceAssigned") : isOnline ? t("onlineLabel") : t("offlineLabel")}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>{t("macAddressLabel")}</span>{" "}
            {staffMember.MacAddress ?? t("notAssignedFallback")}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>{t("currentIpLabel")}</span>{" "}
            {currentIp ?? t("notCurrentlyOnlineFallback")}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>{t("sourceLabel")}</span>{" "}
            {source === "mikrotik" ? "MikroTik" : source === "sophos" ? "Sophos" : "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>{t("deviceLabel2")}</span> {deviceName ?? "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>{t("deviceTypeLabel")}</span>{" "}
            {staffMember.MacAddress ? deviceType : "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>{t("operatingSystemLabel")}</span>{" "}
            {os ?? "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>{t("lastSeenLabel")}</span>{" "}
            {seenAt ? seenAt.toLocaleString() : "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>{t("firstSeenLabel")}</span>{" "}
            {firstSeen ? t("firstSeenAgo", { time: firstSeen.toLocaleString(), duration: formatDuration(firstSeen) }) : "-"}
          </span>
        </div>
      </div>

      {allIps.length > 1 && (
        <div className="dash-panel">
          <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.5rem" }}>{t("deviceIpHistoryTitle")}</h2>
          <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 0 }}>
            {t("ipHistoryCount", { count: allIps.length })}
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.4rem" }}>{t("ipAddressColumn")}</th>
                <th style={{ padding: "0.4rem" }}>{t("networkColumn")}</th>
                <th style={{ padding: "0.4rem" }}>{t("lastUpdatedColumn")}</th>
              </tr>
            </thead>
            <tbody>
              {historicalIps.map((h) => (
                <tr key={`${h.Source}-${h.IpAddress}`} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>{h.IpAddress}</td>
                  <td style={{ padding: "0.4rem" }}>{h.Source === "mikrotik" ? "MikroTik" : "Sophos"}</td>
                  <td style={{ padding: "0.4rem" }}>{new Date(h.UpdatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {allIps.length === 0 ? (
        <div className="dash-panel">
          <p style={{ color: "var(--ink-muted)" }}>
            {t("noDeviceEverSeenNotice")}
          </p>
        </div>
      ) : (
        <>
          <div className="dash-panel">
            <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.5rem" }}>
              {t("webFilterReportTitle")}
            </h2>
            <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 0 }}>
              {t("activityReportSub")}
            </p>
            {webFilterRows.length === 0 ? (
              <p style={{ color: "var(--ink-muted)" }}>{t("noWebFilterEvents")}</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.4rem" }}>{t("timeColumn")}</th>
                    <th style={{ padding: "0.4rem" }}>{t("ipColumn")}</th>
                    <th style={{ padding: "0.4rem" }}>{t("domainColumn")}</th>
                    <th style={{ padding: "0.4rem" }}>{t("categoryColumn")}</th>
                    <th style={{ padding: "0.4rem" }}>{t("actionColumn")}</th>
                  </tr>
                </thead>
                <tbody>
                  {webFilterRows.map((r) => (
                    <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                        {new Date(r.ReceivedAt).toLocaleString()}
                      </td>
                      <td style={{ padding: "0.4rem" }}>
                        <Link href={`/dashboard/web-filter/${encodeURIComponent(r.SrcIp)}`} style={{ color: "var(--series-1)" }}>
                          {r.SrcIp}
                        </Link>
                      </td>
                      <td style={{ padding: "0.4rem" }}>{r.Domain ?? r.Url ?? "-"}</td>
                      <td style={{ padding: "0.4rem" }}>{r.Category ?? "-"}</td>
                      <td style={{ padding: "0.4rem" }}>{r.Action ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="dash-panel">
            <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.5rem" }}>
              {t("routerWebReportTitle")}
            </h2>
            <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 0 }}>
              {t("activityReportSub")}
            </p>
            {routerWebRows.length === 0 ? (
              <p style={{ color: "var(--ink-muted)" }}>{t("noRouterWebConnections")}</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.4rem" }}>{t("timeColumn")}</th>
                    <th style={{ padding: "0.4rem" }}>{t("ipColumn")}</th>
                    <th style={{ padding: "0.4rem" }}>{t("destinationColumn")}</th>
                    <th style={{ padding: "0.4rem" }}>{t("portColumn")}</th>
                  </tr>
                </thead>
                <tbody>
                  {routerWebRows.map((r) => (
                    <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                        {new Date(r.ReceivedAt).toLocaleString()}
                      </td>
                      <td style={{ padding: "0.4rem" }}>
                        <Link href={`/dashboard/router-web/${encodeURIComponent(r.SrcIp)}`} style={{ color: "var(--series-1)" }}>
                          {r.SrcIp}
                        </Link>
                      </td>
                      <td style={{ padding: "0.4rem" }}>
                        {r.ReverseDns ?? r.DstIp ?? "-"}
                        {r.ReverseDns && (
                          <span style={{ color: "var(--ink-muted)", fontSize: "0.75rem" }}> ({r.DstIp})</span>
                        )}
                      </td>
                      <td style={{ padding: "0.4rem" }}>{r.DstPort ?? "-"}</td>
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
