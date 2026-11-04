import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb, sql } from "@/lib/db";
import { classifyDevice } from "@/lib/deviceType";
import { formatDuration, computeDeviceStatus } from "@/lib/staffStatus";
import { parseJsonArray } from "@/lib/parseJsonArray";
import { getBrowserActivityAccess } from "@/lib/requireBrowserActivityPermission";
import { Avatar } from "@/components/ui/Avatar";
import { DeviceReportToggle } from "@/components/staff/DeviceReportToggle";
import { DevicePowerActions } from "@/components/endpointAgents/DevicePowerActions";
import { isSelfDevice } from "@/lib/selfDevice";
import { getAppUsageSessions } from "@/lib/appUsage";
import { CategoryDonutChart, type CategoryDatum } from "@/components/staff/CategoryDonutChart";
import { formatDwell } from "@/components/browserActivity/riskTones";
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
  LocalUserRow,
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
  LastIp: string | null;
  StaticIpAddress: string | null;
  EnrolledAt: string | null;
  VpnActive: boolean | null;
}

interface HistoricalIp {
  IpAddress: string;
  Source: "mikrotik" | "sophos";
  UpdatedAt: string;
}

interface RouterWebRow {
  Id: number;
  ReceivedAt: string;
  SrcIp: string;
  DstIp: string | null;
  DstPort: number | null;
  ReverseDns: string | null;
}

interface WebFilterRow {
  Id: number;
  ReceivedAt: string;
  SrcIp: string;
  Domain: string | null;
  Url: string | null;
  Category: string | null;
  Action: string | null;
  Application: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** exp).toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`;
}

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staffId = Number(id);
  if (!staffId) notFound();

  const t = await getTranslations("employees.detail");
  const db = await getDb();

  // staffResult and linkedDeviceResult both only need staffId - no reason to make the second
  // wait on the first, since that used to just add a whole extra sequential round-trip to
  // every page load.
  const [staffResult, linkedDeviceResult, appUsageSessions] = await Promise.all([
    db
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
          FROM RouterClients rc WHERE rc.MacAddress = s.MacAddress
          ORDER BY UpdatedAt DESC
        ) best
        OUTER APPLY (
          SELECT TOP 1 IpAddress, UpdatedAt, Hostname, Os, FirstSeen
          FROM SophosClients sc WHERE sc.MacAddress = s.MacAddress
          ORDER BY UpdatedAt DESC
        ) sophosBest
        LEFT JOIN OuiVendors ov ON ov.Prefix = REPLACE(LEFT(s.MacAddress, 8), ':', '')
        WHERE s.Id = @id
      `),
    // Reverse-lookup of the existing, already-working Devices.StaffId link (set from the
    // Endpoint Agents device's own "Assigned staff member" field) — surfaced here purely for
    // visibility, not re-editable from this page, so there's only one place that writes it.
    db
      .request()
      .input("id", sql.Int, staffId)
      .query<LinkedDevice>(`
        SELECT d.DeviceId, d.Hostname, d.OS, d.LastHeartbeat, d.LastIp, d.StaticIpAddress, d.EnrolledAt, dni.VpnActive
        FROM Devices d
        LEFT JOIN DeviceNetworkInfo dni ON dni.DeviceId = d.DeviceId
        WHERE d.StaffId = @id
      `),
    getAppUsageSessions({ staffId, limit: 30 }),
  ]);

  const staffMember = staffResult.recordset[0];
  if (!staffMember) notFound();
  const linkedDevice = linkedDeviceResult.recordset[0] ?? null;

  // Single source of truth (computeDeviceStatus in staffStatus.ts) shared with
  // getStaffWithStatus() - this page used to carry its own independent copy of this
  // precedence/freshness logic, which silently reverted to "prefer whichever of agent/router/
  // sophos is freshest" instead of "an enrolled agent always wins once one exists" the first
  // time it was touched, reintroducing the stale-agent-reported-online bug the shared version
  // already fixed once. One implementation instead of two that can drift apart.
  const { source, currentIp, deviceName, os, deviceType, isOnline, isRemoteVpn, firstSeen, lastSeen: seenAt } = computeDeviceStatus({
    macAddress: staffMember.MacAddress,
    computerNameOverride: staffMember.ComputerNameOverride,
    routerIp: staffMember.RouterIp,
    routerHostname: staffMember.Hostname,
    routerStatus: staffMember.Status,
    routerLastSeenRaw: staffMember.LastSeenRaw,
    routerUpdatedAt: staffMember.RouterUpdatedAt,
    routerOs: staffMember.Os,
    routerFirstSeen: staffMember.RouterFirstSeen,
    sophosIp: staffMember.SophosIp,
    sophosUpdatedAt: staffMember.SophosUpdatedAt,
    sophosHostname: staffMember.SophosHostname,
    sophosOs: staffMember.SophosOs,
    sophosFirstSeen: staffMember.SophosFirstSeen,
    vendorName: staffMember.VendorName,
    agentDeviceIp: linkedDevice?.LastIp ?? null,
    agentHostname: linkedDevice?.Hostname ?? null,
    agentOs: linkedDevice?.OS ?? null,
    agentLastHeartbeat: linkedDevice?.LastHeartbeat ?? null,
    agentEnrolledAt: linkedDevice?.EnrolledAt ?? null,
    agentDeviceId: linkedDevice?.DeviceId ?? null,
    agentVpnActive: linkedDevice?.VpnActive ?? null,
  });

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
  let deviceLocalUsers: LocalUserRow[] = [];
  let deviceAlerts: DeviceAlertRow[] = [];
  let deviceUsbEvents: UsbEventRow[] = [];
  let historicalIps: HistoricalIp[] = [];
  let routerWebRows: RouterWebRow[] = [];
  let destinationBreakdown: CategoryDatum[] = [];
  let webFilterRows: WebFilterRow[] = [];
  let webFilterCategoryBreakdown: CategoryDatum[] = [];
  let webFilterApplicationBreakdown: CategoryDatum[] = [];
  let webFilterBandwidthBytes = 0;
  let canViewBrowserActivity = false;
  let browserActivityRows: {
    Id: number;
    VisitedAt: string;
    Domain: string;
    PageTitle: string | null;
    Browser: string;
    CategoryName: string | null;
    DwellSeconds: number | null;
  }[] = [];
  let browserActivityCategoryBreakdown: CategoryDatum[] = [];

  const CHART_WINDOW_DAYS = 30;
  const chartWindowStart = new Date(Date.now() - CHART_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const statusColor = !staffMember.MacAddress ? "unknown" : isOnline ? "good" : isRemoteVpn ? "warning" : "critical";

  // The three sections below (device report, web-filter/router-web activity, browser
  // activity) are entirely independent of each other - previously they ran as three
  // sequential stages, so the page's total load time was the SUM of all three instead of
  // just the slowest one. Running them concurrently is what actually fixes the "takes so
  // long to open" complaint; the query changes within each are secondary wins on top of that.
  const deviceReportChain = (async () => {
    if (!linkedDevice) return;
    const did = linkedDevice.DeviceId;
    const [metricsRes, hwRes, disksRes, diskSpaceRes, volumesRes, secRes, netRes, procRes, svcRes, swRes, localUsersRes, alertsRes, usbRes] = await Promise.all([
      db.request().input("id", sql.VarChar, did).query<{ CpuPct: number | null; MemPct: number | null; DiskPct: number | null }>(
        "SELECT TOP 1 CpuPct, MemPct, DiskPct FROM DeviceMetrics WHERE DeviceId = @id ORDER BY ReceivedAt DESC"
      ),
      db.request().input("id", sql.VarChar, did).query<HardwareInfo>(`
        SELECT dev.Manufacturer AS manufacturer, dev.Model AS model, dev.SerialNumber AS serialNumber,
          dhi.CpuModel AS cpuModel, dhi.CpuManufacturer AS cpuManufacturer, dhi.CpuCores AS cpuCores, dhi.CpuThreads AS cpuThreads,
          dhi.CpuClockMhz AS cpuClockMhz, dhi.MemoryTotalMB AS memoryTotalMB, dhi.DiskModel AS diskModel, dhi.DiskType AS diskType,
          dhi.DiskCapacityGB AS diskCapacityGB, dhi.GpuName AS gpuName, dhi.OsEdition AS osEdition, dhi.OsBuild AS osBuild,
          dhi.KernelVersion AS kernelVersion, dhi.Architecture AS architecture
        FROM DeviceHardwareInfo dhi
        JOIN Devices dev ON dev.DeviceId = dhi.DeviceId
        WHERE dhi.DeviceId = @id
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
      db.request().input("id", sql.VarChar, did).query<LocalUserRow>(`
        SELECT Username AS username, FullName AS fullName, IsAdmin AS isAdmin,
          IsDisabled AS isDisabled, LastLogon AS lastLogon
        FROM DeviceLocalUsers WHERE DeviceId = @id ORDER BY Username ASC
      `),
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
    deviceLocalUsers = localUsersRes.recordset;
    deviceAlerts = alertsRes.recordset;
    deviceUsbEvents = usbRes.recordset;
  })();

  const activityReportChain = (async () => {
    // Every IP this MAC has ever held, on either network — so the activity report below
    // covers the full history, not just whatever the device's IP happens to be right now.
    if (!staffMember.MacAddress) return;
    const historyResult = await db
      .request()
      .input("mac", sql.VarChar, staffMember.MacAddress)
      .query<HistoricalIp>(`
        SELECT IpAddress, 'mikrotik' AS Source, UpdatedAt
        FROM RouterClients WHERE MacAddress = @mac
        UNION ALL
        SELECT IpAddress, 'sophos' AS Source, UpdatedAt
        FROM SophosClients WHERE MacAddress = @mac
        ORDER BY UpdatedAt DESC
      `);
    historicalIps = historyResult.recordset;
    const allIps = [...new Set(historicalIps.map((h) => h.IpAddress))];
    if (allIps.length === 0) return;

    const ipList = allIps.map((_, i) => `@ip${i}`).join(", ");
    const rwRequest = db.request();
    const rwDestinationRequest = db.request();
    // WebFilterLogs is the Sophos-side equivalent of RouterWebLogs above (the MikroTik
    // side) - populated by the same syslog listener's "Content Filtering"/"HTTP" handler,
    // already indexed on (SrcIp, ReceivedAt) for exactly this query shape. Previously there
    // was no panel reading it on this page at all - only translation strings for one
    // (webFilterReportTitle etc. in messages/*.json) that never got wired up, so every
    // Sophos-only employee's activity report looked permanently empty even though their
    // real traffic was being captured the whole time and was already visible on the
    // all-staff /dashboard/web-filter report.
    const wfRowsRequest = db.request();
    const wfCategoryRequest = db.request();
    const wfApplicationRequest = db.request();
    const wfBandwidthRequest = db.request();
    allIps.forEach((ip, i) => {
      rwRequest.input(`ip${i}`, sql.VarChar, ip);
      rwDestinationRequest.input(`ip${i}`, sql.VarChar, ip);
      wfRowsRequest.input(`ip${i}`, sql.VarChar, ip);
      wfCategoryRequest.input(`ip${i}`, sql.VarChar, ip);
      wfApplicationRequest.input(`ip${i}`, sql.VarChar, ip);
      wfBandwidthRequest.input(`ip${i}`, sql.VarChar, ip);
    });

    const [routerWebResult, destinationResult, webFilterResult, webFilterCategoryResult, webFilterApplicationResult, webFilterBandwidthResult] =
      await Promise.all([
        // Bounded to the same CHART_WINDOW_DAYS as the aggregate query below, not full
        // history - this table goes back years, so an unbounded "ORDER BY ReceivedAt DESC" scan
        // across every IP this MAC has ever held (potentially dozens, for a device that's
        // bounced across DHCP leases for a long time) was scanning far more than "the 50 most
        // recent events" actually needs, and was the main reason this page was slow to open.
        rwRequest.input("since", sql.DateTime2, chartWindowStart).query<RouterWebRow>(`
        SELECT TOP 50 Id, ReceivedAt, SrcIp, DstIp, DstPort, ReverseDns
        FROM RouterWebLogs WHERE SrcIp IN (${ipList}) AND ReceivedAt >= @since ORDER BY ReceivedAt DESC
      `),
        rwDestinationRequest.input("since", sql.DateTime2, chartWindowStart).query<{ Destination: string; Cnt: number }>(`
        SELECT COALESCE(NULLIF(ReverseDns, ''), NULLIF(DstIp, ''), 'Unknown') AS Destination, COUNT(*) AS Cnt
        FROM RouterWebLogs WHERE SrcIp IN (${ipList}) AND ReceivedAt >= @since
        GROUP BY COALESCE(NULLIF(ReverseDns, ''), NULLIF(DstIp, ''), 'Unknown')
      `),
        wfRowsRequest.input("since", sql.DateTime2, chartWindowStart).query<WebFilterRow>(`
        SELECT TOP 50 Id, ReceivedAt, SrcIp, Domain, Url, Category, Action, Application
        FROM WebFilterLogs WHERE SrcIp IN (${ipList}) AND ReceivedAt >= @since ORDER BY ReceivedAt DESC
      `),
        wfCategoryRequest.input("since", sql.DateTime2, chartWindowStart).query<{ Category: string; Cnt: number }>(`
        SELECT COALESCE(NULLIF(Category, ''), 'Uncategorized') AS Category, COUNT(*) AS Cnt
        FROM WebFilterLogs WHERE SrcIp IN (${ipList}) AND ReceivedAt >= @since
        GROUP BY COALESCE(NULLIF(Category, ''), 'Uncategorized')
      `),
        wfApplicationRequest.input("since", sql.DateTime2, chartWindowStart).query<{ Application: string; Cnt: number }>(`
        SELECT COALESCE(NULLIF(Application, ''), 'Unknown') AS Application, COUNT(*) AS Cnt
        FROM WebFilterLogs WHERE SrcIp IN (${ipList}) AND ReceivedAt >= @since
        GROUP BY COALESCE(NULLIF(Application, ''), 'Unknown')
      `),
        wfBandwidthRequest.input("since", sql.DateTime2, chartWindowStart).query<{ TotalBytes: number | null }>(`
        SELECT SUM(ISNULL(BytesSent, 0) + ISNULL(BytesReceived, 0)) AS TotalBytes
        FROM WebFilterLogs WHERE SrcIp IN (${ipList}) AND ReceivedAt >= @since
      `),
      ]);
    routerWebRows = routerWebResult.recordset;
    destinationBreakdown = destinationResult.recordset.map((r) => ({ name: r.Destination, value: r.Cnt }));
    webFilterRows = webFilterResult.recordset;
    webFilterCategoryBreakdown = webFilterCategoryResult.recordset.map((r) => ({ name: r.Category, value: r.Cnt }));
    webFilterApplicationBreakdown = webFilterApplicationResult.recordset.map((r) => ({ name: r.Application, value: r.Cnt }));
    webFilterBandwidthBytes = webFilterBandwidthResult.recordset[0]?.TotalBytes ?? 0;
  })();

  // Browser Activity (Agent) - this comes from the endpoint agent reading local browser
  // history directly (page titles, real per-domain dwell estimates), not from Sophos/Mikrotik
  // observing network traffic. Deliberately keyed by Devices.StaffId (not IP/MAC like the
  // panel above) and never merged into the same table - the two have different guarantees
  // and shouldn't be presented as one
  // dataset. Only ever populated for devices where an admin has explicitly enabled the
  // collector (see BrowserActivityIntervalMinutes), so an empty result here is normal, not a
  // sign anything is broken.
  const browserActivityChain = (async () => {
    const { can } = await getBrowserActivityAccess();
    canViewBrowserActivity = can.ba_view === true;
    if (!canViewBrowserActivity) return;
    const canViewPageTitles = can.ba_view_page_titles === true;
    const [rowsResult, categoryResult] = await Promise.all([
      db.request().input("staffId", sql.Int, staffMember.Id).query<{
        Id: number;
        VisitedAt: string;
        Domain: string;
        PageTitle: string | null;
        Browser: string;
        CategoryName: string | null;
        DwellSeconds: number | null;
      }>(`
        SELECT TOP 50 e.Id, e.VisitedAt, e.Domain, e.PageTitle, e.Browser, c.Name AS CategoryName, e.DwellSeconds
        FROM BrowserActivityEvents e LEFT JOIN DomainCategories c ON c.Id = e.CategoryId
        WHERE e.StaffId = @staffId ORDER BY e.VisitedAt DESC
      `),
      db.request().input("staffId", sql.Int, staffMember.Id).input("since", sql.DateTime2, chartWindowStart).query<{ CategoryName: string; Cnt: number }>(`
        SELECT ISNULL(c.Name, 'Uncategorized') AS CategoryName, COUNT(*) AS Cnt
        FROM BrowserActivityEvents e LEFT JOIN DomainCategories c ON c.Id = e.CategoryId
        WHERE e.StaffId = @staffId AND e.VisitedAt >= @since
        GROUP BY c.Name
      `),
    ]);
    browserActivityRows = rowsResult.recordset.map((r) => ({
      ...r,
      PageTitle: canViewPageTitles ? r.PageTitle : r.PageTitle ? "•••" : null,
    }));
    browserActivityCategoryBreakdown = categoryResult.recordset.map((r) => ({ name: r.CategoryName, value: r.Cnt }));
  })();

  await Promise.all([deviceReportChain, activityReportChain, browserActivityChain]);

  const allIps = [...new Set(historicalIps.map((h) => h.IpAddress))];

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
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h2 style={{ fontSize: "1rem", margin: 0 }}>{t("assignedEndpointAgentTitle")}</h2>
          {linkedDevice && (
            <DevicePowerActions
              deviceId={linkedDevice.DeviceId}
              hostname={linkedDevice.Hostname}
              isSelf={isSelfDevice({ hostname: linkedDevice.Hostname, lastIp: linkedDevice.LastIp, staticIpAddress: linkedDevice.StaticIpAddress })}
            />
          )}
        </div>
        {linkedDevice ? (
          <div>
            <p style={{ fontSize: "0.85rem", margin: "0.5rem 0 0.75rem" }}>
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
              localUsers={deviceLocalUsers}
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
        <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.5rem" }}>Application Usage</h2>
        <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginTop: 0, marginBottom: "0.75rem" }}>
          Built from process snapshots polled every ~90 seconds - times are approximate, not exact, and multiple windows/tabs of the
          same app count as one session.
        </p>
        {appUsageSessions.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>No application usage recorded yet.</p>
        ) : (
          <table style={{ width: "100%", fontSize: "0.82rem", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.3rem" }}>Application</th>
                <th style={{ padding: "0.3rem" }}>Started</th>
                <th style={{ padding: "0.3rem" }}>Ended</th>
                <th style={{ padding: "0.3rem" }}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {appUsageSessions.map((s) => {
                const start = new Date(s.startedAt).getTime();
                const end = s.endedAt ? new Date(s.endedAt).getTime() : new Date(s.lastSeenAt).getTime();
                const durationMin = Math.max(0, Math.round((end - start) / 60000));
                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.3rem" }}>{s.processName}</td>
                    <td style={{ padding: "0.3rem", whiteSpace: "nowrap" }}>{new Date(s.startedAt).toLocaleString()}</td>
                    <td style={{ padding: "0.3rem", whiteSpace: "nowrap" }}>
                      {s.endedAt ? new Date(s.endedAt).toLocaleString() : <span style={{ color: "var(--success)" }}>Still running</span>}
                    </td>
                    <td style={{ padding: "0.3rem" }}>
                      {durationMin < 60 ? `${durationMin}m` : `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="dash-panel">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", fontSize: "0.85rem" }}>
          <span>
            <span className={`status-dot status-${statusColor}`} style={{ marginRight: "0.4rem" }} />
            <span style={{ color: "var(--ink-muted)" }}>{t("statusLabel")}</span>{" "}
            {!staffMember.MacAddress
              ? t("noDeviceAssigned")
              : isOnline
                ? t("onlineLabel")
                : isRemoteVpn
                  ? <span title={t("offlineRemoteHint")}>{t("offlineRemoteLabel")}</span>
                  : t("offlineLabel")}
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
            {source === "mikrotik" ? "MikroTik" : source === "sophos" ? "Sophos" : source === "agent" ? "Agent" : "-"}
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

      {/* Each panel below already has its own empty-state message (Web Filter's and Router
          Web Connections' "No ... yet" messages, Browser Activity's implicit empty table) -
          no need for an outer "no device ever seen" gate here. That gate used to wrap these
          panels behind allIps.length (MAC-derived network history only), which meant a
          direct-enrollment employee with no MacAddress at all never saw their own working
          Browser Activity data, even though it has nothing to do with MAC-based history. */}
      <>
          <div className="dash-panel">
            <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.5rem" }}>{t("webFilterReportTitle")}</h2>
            <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 0 }}>{t("activityReportSub")}</p>
            {(webFilterCategoryBreakdown.length > 0 || webFilterApplicationBreakdown.length > 0) && (
              <div className="flex flex-wrap gap-4" style={{ marginBottom: "1rem" }}>
                {webFilterCategoryBreakdown.length > 0 && (
                  <div style={{ maxWidth: 420, flex: "1 1 320px" }}>
                    <CategoryDonutChart title={t("categoryChartTitle")} data={webFilterCategoryBreakdown} emptyMessage={t("noWebFilterEvents")} />
                  </div>
                )}
                {webFilterApplicationBreakdown.length > 0 && (
                  <div style={{ maxWidth: 420, flex: "1 1 320px" }}>
                    <CategoryDonutChart title={t("applicationChartTitle")} data={webFilterApplicationBreakdown} emptyMessage={t("noWebFilterEvents")} />
                  </div>
                )}
              </div>
            )}
            {webFilterBandwidthBytes > 0 && (
              <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>
                {t("bandwidthLabel")} {formatBytes(webFilterBandwidthBytes)}
              </p>
            )}
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
                    <th style={{ padding: "0.4rem" }}>{t("applicationColumn")}</th>
                  </tr>
                </thead>
                <tbody>
                  {webFilterRows.map((r) => (
                    <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(r.ReceivedAt).toLocaleString()}</td>
                      <td style={{ padding: "0.4rem" }}>
                        <Link href={`/dashboard/web-filter/${encodeURIComponent(r.SrcIp)}`} style={{ color: "var(--series-1)" }}>
                          {r.SrcIp}
                        </Link>
                      </td>
                      <td style={{ padding: "0.4rem" }}>{r.Domain ?? r.Url ?? "-"}</td>
                      <td style={{ padding: "0.4rem" }}>{r.Category ?? "-"}</td>
                      <td style={{ padding: "0.4rem" }}>{r.Action ?? "-"}</td>
                      <td style={{ padding: "0.4rem" }}>{r.Application ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {canViewBrowserActivity && (
            <div className="dash-panel">
              <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.5rem" }}>
                Browser Activity (Agent)
              </h2>
              <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 0 }}>
                From the endpoint agent reading local browser history directly - higher fidelity than the network-observed
                Web Filter report above, but only populated for devices where an admin has enabled it.
              </p>
              {browserActivityCategoryBreakdown.length > 0 && (
                <div style={{ marginBottom: "1rem", maxWidth: 420 }}>
                  <CategoryDonutChart title="By Category" data={browserActivityCategoryBreakdown} emptyMessage="No browser activity recorded." />
                </div>
              )}
              {browserActivityRows.length === 0 ? (
                <p style={{ color: "var(--ink-muted)" }}>No browser activity recorded for this employee&apos;s device(s).</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "0.4rem" }}>Visited At</th>
                      <th style={{ padding: "0.4rem" }}>Domain</th>
                      <th style={{ padding: "0.4rem" }}>Page Title</th>
                      <th style={{ padding: "0.4rem" }}>Browser</th>
                      <th style={{ padding: "0.4rem" }}>Category</th>
                      <th style={{ padding: "0.4rem" }}>Time Spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {browserActivityRows.map((r) => (
                      <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                        <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(r.VisitedAt).toLocaleString()}</td>
                        <td style={{ padding: "0.4rem" }}>{r.Domain}</td>
                        <td style={{ padding: "0.4rem" }}>{r.PageTitle ?? "—"}</td>
                        <td style={{ padding: "0.4rem", textTransform: "capitalize" }}>{r.Browser}</td>
                        <td style={{ padding: "0.4rem" }}>{r.CategoryName ?? "Uncategorized"}</td>
                        <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{formatDwell(r.DwellSeconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <div id="router-web" className="dash-panel">
            <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.5rem" }}>
              {t("routerWebReportTitle")}
            </h2>
            <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 0 }}>
              {t("activityReportSub")}
            </p>
            {destinationBreakdown.length > 0 && (
              <div style={{ marginBottom: "1rem", maxWidth: 420 }}>
                <CategoryDonutChart title={t("destinationChartTitle")} data={destinationBreakdown} emptyMessage={t("noRouterWebConnections")} />
              </div>
            )}
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
    </div>
  );
}


