import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { DeviceDetail, type DeviceDetailData, type MetricPoint, type ScreenshotRow } from "@/components/endpointAgents/DeviceDetail";

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
      ScreenshotIntervalMinutes: number | null;
      PrivacyMode: boolean;
      EnrolledAt: string;
      ConsentAcceptedAt: string | null;
    }>(`
      SELECT d.DeviceId, d.Hostname, d.OS, d.OsVersion, d.AgentVersion, d.Department, d.StaffId, s.Name AS StaffName,
        d.LastHeartbeat, d.LastIp, d.ScreenshotIntervalMinutes, d.PrivacyMode, d.EnrolledAt, d.ConsentAcceptedAt
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
    online: device.LastHeartbeat ? Date.now() - new Date(device.LastHeartbeat).getTime() <= 90000 : false,
    screenshotIntervalMinutes: device.ScreenshotIntervalMinutes,
    privacyMode: device.PrivacyMode,
    enrolledAt: device.EnrolledAt,
    consentAcceptedAt: device.ConsentAcceptedAt,
  };

  return (
    <DeviceDetail
      device={data}
      metrics={metrics}
      screenshots={screenshots}
      staffOptions={staffResult.recordset.map((s) => ({ id: s.Id, name: s.Name }))}
    />
  );
}
