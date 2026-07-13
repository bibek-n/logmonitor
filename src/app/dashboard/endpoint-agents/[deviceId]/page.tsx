import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { matchDeviceByMac } from "@/lib/deviceMatch";
import {
  DeviceDetail,
  type DeviceDetailData,
  type MetricPoint,
  type ScreenshotRow,
  type HardwareInfo,
  type DiskRow,
  type DiskSpace,
  type SecurityStatus,
  type NetworkInfo,
  type ProcessRow,
  type ServiceRow,
  type SoftwareRow,
  type DeviceAlertRow,
  type UsbEventRow,
} from "@/components/endpointAgents/DeviceDetail";

function parseJsonArray<T>(json: string | null | undefined): T[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const dynamic = "force-dynamic";

export default async function DeviceDetailPage({ params }: { params: Promise<{ deviceId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Device</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view endpoint agent data.</p>
      </div>
    );
  }

  const { deviceId } = await params;
  const db = await getDb();

  const deviceResult = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .query<{
      DeviceId: string;
      Hostname: string;
      OS: string;
      OsVersion: string | null;
      AgentVersion: string | null;
      Department: string | null;
      StaffId: number | null;
      StaffName: string | null;
      LastHeartbeat: string | null;
      LastIp: string | null;
      MacAddress: string | null;
      ScreenshotIntervalMinutes: number | null;
      PrivacyMode: boolean;
      EnrolledAt: string;
      ConsentAcceptedAt: string | null;
    }>(`
      SELECT d.DeviceId, d.Hostname, d.OS, d.OsVersion, d.AgentVersion, d.Department, d.StaffId, s.Name AS StaffName,
        d.LastHeartbeat, d.LastIp, d.MacAddress, d.ScreenshotIntervalMinutes, d.PrivacyMode, d.EnrolledAt, d.ConsentAcceptedAt
      FROM Devices d
      LEFT JOIN Staff s ON s.Id = d.StaffId
      WHERE d.DeviceId = @deviceId
    `);

  const device = deviceResult.recordset[0];
  if (!device) notFound();

  const staffResult = await db.query<{ Id: number; Name: string }>("SELECT Id, Name FROM Staff ORDER BY Name");

  const metricsResult = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .query<{ ReceivedAt: string; CpuPct: number | null; MemPct: number | null; DiskPct: number | null; NetRxMbps: number | null; NetTxMbps: number | null }>(`
      SELECT TOP 50 ReceivedAt, CpuPct, MemPct, DiskPct, NetRxMbps, NetTxMbps
      FROM DeviceMetrics WHERE DeviceId = @deviceId ORDER BY ReceivedAt DESC
    `);
  const metrics: MetricPoint[] = metricsResult.recordset
    .map((r) => ({
      t: r.ReceivedAt,
      cpu: r.CpuPct,
      mem: r.MemPct,
      disk: r.DiskPct,
      netRx: r.NetRxMbps,
      netTx: r.NetTxMbps,
    }))
    .reverse();

  const screenshotsResult = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .query<{
      Id: number;
      CapturedAt: string;
      CapturedBy: string;
      FileSizeBytes: number;
      RequestedByUsername: string | null;
    }>(`
      SELECT sc.Id, sc.CapturedAt, sc.CapturedBy, sc.FileSizeBytes, u.Username AS RequestedByUsername
      FROM Screenshots sc
      LEFT JOIN Users u ON u.Id = sc.RequestedByUserId
      WHERE sc.DeviceId = @deviceId AND sc.DeletedAt IS NULL
      ORDER BY sc.CapturedAt DESC
    `);
  const screenshots: ScreenshotRow[] = screenshotsResult.recordset.map((r) => ({
    id: r.Id,
    capturedAt: r.CapturedAt,
    capturedBy: r.CapturedBy,
    fileSizeBytes: r.FileSizeBytes,
    requestedByUsername: r.RequestedByUsername,
  }));

  const data: DeviceDetailData = {
    deviceId: device.DeviceId,
    hostname: device.Hostname,
    os: device.OS,
    osVersion: device.OsVersion,
    agentVersion: device.AgentVersion,
    department: device.Department,
    staffId: device.StaffId,
    staffName: device.StaffName,
    lastIp: device.LastIp,
    macAddress: device.MacAddress,
    online: device.LastHeartbeat ? Date.now() - new Date(device.LastHeartbeat).getTime() <= 90000 : false,
    screenshotIntervalMinutes: device.ScreenshotIntervalMinutes,
    privacyMode: device.PrivacyMode,
    enrolledAt: device.EnrolledAt,
    consentAcceptedAt: device.ConsentAcceptedAt,
  };

  const macMatch = await matchDeviceByMac(device.MacAddress);

  const [hardwareResult, disksResult, diskSpaceResult, securityResult, networkResult, processResult, serviceResult, softwareResult, alertsResult, usbResult] =
    await Promise.all([
      db.request().input("deviceId", sql.VarChar, deviceId).query<HardwareInfo>(`
        SELECT CpuModel AS cpuModel, CpuManufacturer AS cpuManufacturer, CpuCores AS cpuCores, CpuThreads AS cpuThreads,
          CpuClockMhz AS cpuClockMhz, MemoryTotalMB AS memoryTotalMB, DiskModel AS diskModel, DiskType AS diskType,
          DiskCapacityGB AS diskCapacityGB, GpuName AS gpuName, OsEdition AS osEdition, OsBuild AS osBuild,
          KernelVersion AS kernelVersion, Architecture AS architecture
        FROM DeviceHardwareInfo WHERE DeviceId = @deviceId
      `),
      db.request().input("deviceId", sql.VarChar, deviceId).query<DiskRow>(`
        SELECT DiskIndex AS diskIndex, Model AS model, Type AS type, CapacityGB AS capacityGB,
          HealthStatus AS healthStatus, OperationalStatus AS operationalStatus, TemperatureCelsius AS temperatureCelsius
        FROM DeviceDisks WHERE DeviceId = @deviceId ORDER BY DiskIndex ASC
      `),
      db.request().input("deviceId", sql.VarChar, deviceId).query<DiskSpace>(`
        SELECT TOP 1 DiskFreeGB AS freeGB, DiskTotalGB AS totalGB
        FROM DeviceMetrics WHERE DeviceId = @deviceId ORDER BY ReceivedAt DESC
      `),
      db.request().input("deviceId", sql.VarChar, deviceId).query<SecurityStatus>(`
        SELECT AntivirusStatus AS antivirusStatus, DefenderStatus AS defenderStatus, FirewallEnabled AS firewallEnabled,
          FirewallRulesCount AS firewallRulesCount, BitLockerStatus AS bitLockerStatus, LuksStatus AS luksStatus,
          SecureBootEnabled AS secureBootEnabled, TpmVersion AS tpmVersion, SELinuxStatus AS selinuxStatus,
          AppArmorStatus AS apparmorStatus, FailedLoginCount24h AS failedLoginCount24h
        FROM DeviceSecurityStatus WHERE DeviceId = @deviceId
      `),
      db.request().input("deviceId", sql.VarChar, deviceId).query<{
        currentIp: string | null; publicIp: string | null; gatewayIp: string | null; dnsServers: string | null;
        wifiSsid: string | null; vpnActive: boolean | null; ethernetConnected: boolean | null;
        openPortsJson: string | null; listeningPortsJson: string | null;
      }>(`
        SELECT CurrentIp AS currentIp, PublicIp AS publicIp, GatewayIp AS gatewayIp, DnsServers AS dnsServers,
          WifiSsid AS wifiSsid, VpnActive AS vpnActive, EthernetConnected AS ethernetConnected,
          OpenPortsJson AS openPortsJson, ListeningPortsJson AS listeningPortsJson
        FROM DeviceNetworkInfo WHERE DeviceId = @deviceId
      `),
      db.request().input("deviceId", sql.VarChar, deviceId).query<{ ProcessesJson: string }>(
        "SELECT ProcessesJson FROM DeviceProcessSnapshot WHERE DeviceId = @deviceId"
      ),
      db.request().input("deviceId", sql.VarChar, deviceId).query<{ ServicesJson: string }>(
        "SELECT ServicesJson FROM DeviceServiceSnapshot WHERE DeviceId = @deviceId"
      ),
      db.request().input("deviceId", sql.VarChar, deviceId).query<{ SoftwareJson: string }>(
        "SELECT SoftwareJson FROM DeviceSoftwareSnapshot WHERE DeviceId = @deviceId"
      ),
      db.request().input("deviceId", sql.VarChar, deviceId).query<DeviceAlertRow>(`
        SELECT TOP 20 Id AS id, AlertType AS alertType, Severity AS severity, Message AS message,
          TriggeredAt AS triggeredAt, ResolvedAt AS resolvedAt
        FROM DeviceAlerts WHERE DeviceId = @deviceId ORDER BY TriggeredAt DESC
      `),
      db.request().input("deviceId", sql.VarChar, deviceId).query<UsbEventRow>(`
        SELECT TOP 20 EventType AS eventType, DeviceName AS deviceName, SerialNumber AS serialNumber,
          StorageCapacityGB AS storageCapacityGB, DetectedAt AS detectedAt
        FROM DeviceUsbEvents WHERE DeviceId = @deviceId ORDER BY DetectedAt DESC
      `),
    ]);

  const network: NetworkInfo | null = networkResult.recordset[0]
    ? {
        ...networkResult.recordset[0],
        openPorts: parseJsonArray<number>(networkResult.recordset[0].openPortsJson),
        listeningPorts: parseJsonArray<number>(networkResult.recordset[0].listeningPortsJson),
      }
    : null;

  return (
    <DeviceDetail
      device={data}
      metrics={metrics}
      screenshots={screenshots}
      staffOptions={staffResult.recordset.map((s) => ({ id: s.Id, name: s.Name }))}
      hardware={hardwareResult.recordset[0] ?? null}
      disks={disksResult.recordset}
      diskSpace={diskSpaceResult.recordset[0] ?? null}
      security={securityResult.recordset[0] ?? null}
      network={network}
      processes={parseJsonArray<ProcessRow>(processResult.recordset[0]?.ProcessesJson)}
      services={parseJsonArray<ServiceRow>(serviceResult.recordset[0]?.ServicesJson)}
      software={parseJsonArray<SoftwareRow>(softwareResult.recordset[0]?.SoftwareJson)}
      alerts={alertsResult.recordset}
      usbEvents={usbResult.recordset}
      macMatch={macMatch}
    />
  );
}
