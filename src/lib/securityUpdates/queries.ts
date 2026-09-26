import { getDb, sql } from "@/lib/db";
import { agentSupportsUpdateScan, SCAN_MAX_HEARTBEAT_AGE_SECONDS } from "./agentSupport";

// Read-side queries for the Security & Updates pages. Timestamps go out as ISO-8601 UTC strings WITHOUT a
// zone marker (CONVERT ... 126) exactly like the rest of this app; the client renders them with
// formatUtcTimestamp() (see src/lib/formatUtcTimestamp.ts).

const LATEST_SCANS = `
  SELECT s.*, ROW_NUMBER() OVER (PARTITION BY s.DeviceId ORDER BY s.ScannedAt DESC) AS rn
  FROM DeviceUpdateScans s
`;

export interface OsSummary {
  devices: number;
  scanned: number;
  withPending: number;
  updates: number;
  security: number;
  critical: number;
  failed: number;
  reboot: number;
}

const emptyOs = (): OsSummary => ({ devices: 0, scanned: 0, withPending: 0, updates: 0, security: 0, critical: 0, failed: 0, reboot: 0 });

export async function getSummary() {
  const db = await getDb();

  const devs = await db.query<{ OS: string | null; AgentVersion: string | null; HbAge: number | null }>(
    "SELECT OS, AgentVersion, DATEDIFF(SECOND, LastHeartbeat, SYSUTCDATETIME()) AS HbAge FROM Devices"
  );
  const scans = await db.query<{
    OS: string | null;
    Scanned: number;
    WithPending: number;
    Updates: number;
    Security: number;
    Critical: number;
    Failed: number;
    Reboot: number;
    LastScan: string | null;
  }>(`
    WITH latest AS (${LATEST_SCANS})
    SELECT d.OS, COUNT(*) AS Scanned,
      SUM(CASE WHEN l.PendingCount > 0 THEN 1 ELSE 0 END) AS WithPending,
      SUM(l.PendingCount) AS Updates, SUM(l.SecurityCount) AS Security, SUM(l.CriticalCount) AS Critical,
      SUM(l.FailedCount) AS Failed, SUM(CASE WHEN l.RebootRequired = 1 THEN 1 ELSE 0 END) AS Reboot,
      CONVERT(VARCHAR(19), MAX(l.ScannedAt), 126) AS LastScan
    FROM latest l JOIN Devices d ON d.DeviceId = l.DeviceId
    WHERE l.rn = 1 AND l.Supported = 1
    GROUP BY d.OS
  `);

  const byOs: Record<string, OsSummary> = { windows: emptyOs(), linux: emptyOs(), darwin: emptyOs(), other: emptyOs() };
  const bucket = (os: string | null) => (os === "windows" || os === "linux" || os === "darwin" ? os : "other");

  let outdatedAgents = 0;
  for (const d of devs.recordset) {
    byOs[bucket(d.OS)].devices++;
    const online = d.HbAge !== null && d.HbAge <= SCAN_MAX_HEARTBEAT_AGE_SECONDS;
    if (online && !agentSupportsUpdateScan(d.AgentVersion)) outdatedAgents++;
  }

  const totals = emptyOs();
  let lastScanAt: string | null = null;
  for (const r of scans.recordset) {
    const o = byOs[bucket(r.OS)];
    o.scanned += r.Scanned;
    o.withPending += r.WithPending ?? 0;
    o.updates += r.Updates ?? 0;
    o.security += r.Security ?? 0;
    o.critical += r.Critical ?? 0;
    o.failed += r.Failed ?? 0;
    o.reboot += r.Reboot ?? 0;
    if (r.LastScan && (!lastScanAt || r.LastScan > lastScanAt)) lastScanAt = r.LastScan;
  }
  for (const o of Object.values(byOs)) {
    totals.devices += o.devices;
    totals.scanned += o.scanned;
    totals.withPending += o.withPending;
    totals.updates += o.updates;
    totals.security += o.security;
    totals.critical += o.critical;
    totals.failed += o.failed;
    totals.reboot += o.reboot;
  }

  return { totals, byOs, lastScanAt, outdatedAgents, neverScanned: Math.max(0, totals.devices - totals.scanned) };
}

export interface DeviceListFilters {
  os?: string;
  type?: string;
  status?: string; // needs | failed | reboot | clean | never
  q?: string;
  page: number;
  pageSize: number;
}

function deviceWhere(f: DeviceListFilters, rq: ReturnType<Awaited<ReturnType<typeof getDb>>["request"]>): string {
  const where: string[] = ["1 = 1"];
  if (f.os) {
    rq.input("os", sql.VarChar, f.os);
    where.push("d.OS = @os");
  }
  if (f.type) {
    rq.input("type", sql.VarChar, f.type);
    where.push("d.DeviceType = @type");
  }
  if (f.q) {
    rq.input("q", sql.NVarChar, `%${f.q}%`);
    where.push("(d.Hostname LIKE @q OR d.DeviceName LIKE @q OR st.Name LIKE @q OR d.LastIp LIKE @q)");
  }
  switch (f.status) {
    case "needs":
      where.push("l.PendingCount > 0");
      break;
    case "failed":
      where.push("l.FailedCount > 0");
      break;
    case "reboot":
      where.push("l.RebootRequired = 1");
      break;
    case "clean":
      where.push("l.DeviceId IS NOT NULL AND l.Supported = 1 AND l.PendingCount = 0 AND l.FailedCount = 0");
      break;
    case "never":
      where.push("l.DeviceId IS NULL");
      break;
  }
  return where.join(" AND ");
}

const DEVICE_JOINS = `
  FROM Devices d
  LEFT JOIN Staff st ON st.Id = d.StaffId
  LEFT JOIN latest l ON l.DeviceId = d.DeviceId AND l.rn = 1`;

export async function listDevices(f: DeviceListFilters) {
  const db = await getDb();

  const countReq = db.request();
  const where = deviceWhere(f, countReq);
  const total = await countReq.query<{ Cnt: number }>(`WITH latest AS (${LATEST_SCANS}) SELECT COUNT(*) AS Cnt ${DEVICE_JOINS} WHERE ${where}`);

  const rq = db.request();
  deviceWhere(f, rq);
  rq.input("offset", sql.Int, (f.page - 1) * f.pageSize).input("pageSize", sql.Int, f.pageSize);
  const rows = await rq.query(`
    WITH latest AS (${LATEST_SCANS})
    SELECT d.DeviceId, d.Hostname, d.DeviceName, d.DeviceType, d.OS, d.AgentVersion, d.LastIp, st.Name AS StaffName,
      DATEDIFF(SECOND, d.LastHeartbeat, SYSUTCDATETIME()) AS HbAge,
      CONVERT(VARCHAR(19), l.ScannedAt, 126) AS ScannedAt, l.Family, l.Supported, l.Complete, l.RebootRequired,
      l.PendingCount, l.SecurityCount, l.CriticalCount, l.KernelCount, l.FirmwareCount, l.DriverCount, l.ApplicationCount, l.PackageCount, l.FailedCount,
      l.DefinitionsName, l.DefinitionsVersion, l.DefinitionsAgeDays, l.LastInstalledAt, l.WarningsJson
    ${DEVICE_JOINS}
    WHERE ${where}
    ORDER BY CASE WHEN l.DeviceId IS NULL THEN 1 ELSE 0 END, l.CriticalCount DESC, l.SecurityCount DESC, l.PendingCount DESC, d.Hostname
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`);

  return {
    total: total.recordset[0]?.Cnt ?? 0,
    rows: rows.recordset.map((r) => ({
      deviceId: r.DeviceId as string,
      hostname: r.Hostname as string,
      deviceName: (r.DeviceName as string | null) ?? null,
      deviceType: r.DeviceType as string,
      os: (r.OS as string | null) ?? null,
      agentVersion: (r.AgentVersion as string | null) ?? null,
      ip: (r.LastIp as string | null) ?? null,
      staffName: (r.StaffName as string | null) ?? null,
      online: r.HbAge !== null && r.HbAge <= SCAN_MAX_HEARTBEAT_AGE_SECONDS,
      agentSupportsScan: agentSupportsUpdateScan(r.AgentVersion),
      scannedAt: (r.ScannedAt as string | null) ?? null,
      family: (r.Family as string | null) ?? null,
      supported: r.Supported === null ? null : !!r.Supported,
      complete: r.Complete === null ? null : !!r.Complete,
      rebootRequired: r.RebootRequired === null ? null : !!r.RebootRequired,
      pending: (r.PendingCount as number | null) ?? null,
      security: (r.SecurityCount as number | null) ?? null,
      critical: (r.CriticalCount as number | null) ?? null,
      kernel: (r.KernelCount as number | null) ?? null,
      firmware: (r.FirmwareCount as number | null) ?? null,
      driver: (r.DriverCount as number | null) ?? null,
      application: (r.ApplicationCount as number | null) ?? null,
      package: (r.PackageCount as number | null) ?? null,
      failed: (r.FailedCount as number | null) ?? null,
      definitions: r.DefinitionsName ? { name: r.DefinitionsName as string, version: r.DefinitionsVersion as string, ageDays: (r.DefinitionsAgeDays as number | null) ?? null } : null,
      lastInstalledAt: (r.LastInstalledAt as string | null) ?? null,
      warnings: r.WarningsJson ? (JSON.parse(r.WarningsJson as string) as string[]) : [],
    })),
  };
}

export async function getDeviceDetails(deviceId: string) {
  const db = await getDb();

  const dev = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .query(`SELECT d.DeviceId, d.Hostname, d.DeviceName, d.DeviceType, d.OS, d.AgentVersion, d.LastIp, st.Name AS StaffName,
        DATEDIFF(SECOND, d.LastHeartbeat, SYSUTCDATETIME()) AS HbAge
      FROM Devices d LEFT JOIN Staff st ON st.Id = d.StaffId WHERE d.DeviceId = @deviceId`);
  const d = dev.recordset[0];
  if (!d) return null;

  const scan = await db.request().input("deviceId", sql.VarChar, deviceId).query(`
    SELECT TOP 1 CONVERT(VARCHAR(19), ScannedAt, 126) AS ScannedAt, TriggerType, Family, Supported, Complete, RebootRequired, PendingCount, SecurityCount, CriticalCount,
      KernelCount, FirmwareCount, DriverCount, ApplicationCount, PackageCount, FailedCount, LastInstalledAt, DefinitionsName, DefinitionsVersion, DefinitionsAgeDays, WarningsJson
    FROM DeviceUpdateScans WHERE DeviceId = @deviceId ORDER BY ScannedAt DESC`);

  const updates = await db.request().input("deviceId", sql.VarChar, deviceId).query(`
    SELECT UpdateKey, Title, Category, Severity, CurrentVersion, NewVersion, SizeMB, RequiresReboot, IsDisruptive, Status, FailureMessage,
      CONVERT(VARCHAR(19), FirstSeenAt, 126) AS FirstSeenAt, CONVERT(VARCHAR(19), LastSeenAt, 126) AS LastSeenAt, IncidentNumber
    FROM DeviceUpdates WHERE DeviceId = @deviceId AND Status IN ('Pending', 'Failed', 'Deferred')
    ORDER BY CASE Status WHEN 'Failed' THEN 0 ELSE 1 END,
      CASE Category WHEN 'critical' THEN 0 WHEN 'security' THEN 1 WHEN 'kernel' THEN 2 WHEN 'os' THEN 3 WHEN 'firmware' THEN 4 WHEN 'driver' THEN 5 WHEN 'application' THEN 6 ELSE 7 END, Title`);

  const history = await db.request().input("deviceId", sql.VarChar, deviceId).query(`
    SELECT TOP 25 Id, EventType, Title, Category, Detail, ActorName, IncidentNumber, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
    FROM UpdateHistory WHERE DeviceId = @deviceId ORDER BY CreatedAt DESC, Id DESC`);

  const s = scan.recordset[0];
  return {
    device: {
      deviceId: d.DeviceId as string,
      hostname: d.Hostname as string,
      deviceName: (d.DeviceName as string | null) ?? null,
      deviceType: d.DeviceType as string,
      os: (d.OS as string | null) ?? null,
      agentVersion: (d.AgentVersion as string | null) ?? null,
      ip: (d.LastIp as string | null) ?? null,
      staffName: (d.StaffName as string | null) ?? null,
      online: d.HbAge !== null && d.HbAge <= SCAN_MAX_HEARTBEAT_AGE_SECONDS,
      agentSupportsScan: agentSupportsUpdateScan(d.AgentVersion),
    },
    scan: s
      ? {
          scannedAt: s.ScannedAt as string,
          trigger: s.TriggerType as string,
          family: (s.Family as string | null) ?? null,
          supported: !!s.Supported,
          complete: !!s.Complete,
          rebootRequired: !!s.RebootRequired,
          pending: s.PendingCount as number,
          security: s.SecurityCount as number,
          critical: s.CriticalCount as number,
          kernel: s.KernelCount as number,
          firmware: s.FirmwareCount as number,
          driver: s.DriverCount as number,
          application: s.ApplicationCount as number,
          package: s.PackageCount as number,
          failed: s.FailedCount as number,
          lastInstalledAt: (s.LastInstalledAt as string | null) ?? null,
          definitions: s.DefinitionsName ? { name: s.DefinitionsName as string, version: s.DefinitionsVersion as string, ageDays: (s.DefinitionsAgeDays as number | null) ?? null } : null,
          warnings: s.WarningsJson ? (JSON.parse(s.WarningsJson as string) as string[]) : [],
        }
      : null,
    updates: updates.recordset.map((u) => ({
      key: u.UpdateKey as string,
      title: u.Title as string,
      category: u.Category as string,
      severity: u.Severity as string,
      currentVersion: (u.CurrentVersion as string | null) ?? null,
      newVersion: (u.NewVersion as string | null) ?? null,
      sizeMB: u.SizeMB === null ? null : Number(u.SizeMB),
      requiresReboot: !!u.RequiresReboot,
      isDisruptive: !!u.IsDisruptive,
      status: u.Status as string,
      failureMessage: (u.FailureMessage as string | null) ?? null,
      firstSeenAt: u.FirstSeenAt as string,
      lastSeenAt: u.LastSeenAt as string,
      incidentNumber: (u.IncidentNumber as string | null) ?? null,
    })),
    history: history.recordset.map((h) => ({
      id: h.Id as number,
      eventType: h.EventType as string,
      title: (h.Title as string | null) ?? null,
      category: (h.Category as string | null) ?? null,
      detail: (h.Detail as string | null) ?? null,
      actor: (h.ActorName as string | null) ?? null,
      incidentNumber: (h.IncidentNumber as string | null) ?? null,
      createdAt: h.CreatedAt as string,
    })),
  };
}

export interface HistoryFilters {
  from?: string;
  to?: string;
  deviceId?: string;
  q?: string;
  os?: string;
  eventType?: string;
  actor?: string;
  incident?: string;
  page: number;
  pageSize: number;
}

function historyWhere(f: HistoryFilters, rq: ReturnType<Awaited<ReturnType<typeof getDb>>["request"]>): string {
  const where: string[] = ["1 = 1"];
  if (f.from) {
    rq.input("from", sql.DateTime2, new Date(`${f.from}T00:00:00Z`));
    where.push("h.CreatedAt >= @from");
  }
  if (f.to) {
    rq.input("to", sql.DateTime2, new Date(`${f.to}T00:00:00Z`));
    where.push("h.CreatedAt < DATEADD(DAY, 1, @to)");
  }
  if (f.deviceId) {
    rq.input("deviceId", sql.VarChar, f.deviceId);
    where.push("h.DeviceId = @deviceId");
  }
  if (f.q) {
    rq.input("q", sql.NVarChar, `%${f.q}%`);
    where.push("(h.Hostname LIKE @q OR h.Title LIKE @q OR h.Detail LIKE @q OR h.UpdateKey LIKE @q)");
  }
  if (f.os) {
    rq.input("os", sql.VarChar, f.os);
    where.push("h.OS = @os");
  }
  if (f.eventType) {
    rq.input("eventType", sql.VarChar, f.eventType);
    where.push("h.EventType = @eventType");
  }
  if (f.actor) {
    rq.input("actor", sql.NVarChar, `%${f.actor}%`);
    where.push("h.ActorName LIKE @actor");
  }
  if (f.incident) {
    rq.input("incident", sql.VarChar, f.incident.trim());
    where.push("h.IncidentNumber = @incident");
  }
  return where.join(" AND ");
}

const HISTORY_COLUMNS = `h.Id, h.DeviceId, h.Hostname, h.OS, h.EventType, h.UpdateKey, h.Title, h.Category, h.Detail, h.ActorName, h.RequestId, h.IncidentNumber,
  CONVERT(VARCHAR(19), h.CreatedAt, 126) AS CreatedAt`;

export async function listHistory(f: HistoryFilters) {
  const db = await getDb();
  const countReq = db.request();
  const where = historyWhere(f, countReq);
  const total = await countReq.query<{ Cnt: number }>(`SELECT COUNT(*) AS Cnt FROM UpdateHistory h WHERE ${where}`);

  const rq = db.request();
  historyWhere(f, rq);
  rq.input("offset", sql.Int, (f.page - 1) * f.pageSize).input("pageSize", sql.Int, f.pageSize);
  const rows = await rq.query(
    `SELECT ${HISTORY_COLUMNS} FROM UpdateHistory h WHERE ${where} ORDER BY h.CreatedAt DESC, h.Id DESC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`
  );
  return { total: total.recordset[0]?.Cnt ?? 0, rows: rows.recordset.map(mapHistory) };
}

export async function exportHistory(f: HistoryFilters, limit = 5000) {
  const db = await getDb();
  const rq = db.request();
  const where = historyWhere(f, rq);
  const rows = await rq.query(`SELECT TOP (${Math.min(limit, 5000)}) ${HISTORY_COLUMNS} FROM UpdateHistory h WHERE ${where} ORDER BY h.CreatedAt DESC, h.Id DESC`);
  return rows.recordset.map(mapHistory);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapHistory(h: any) {
  return {
    id: h.Id as number,
    deviceId: (h.DeviceId as string | null) ?? null,
    hostname: (h.Hostname as string | null) ?? null,
    os: (h.OS as string | null) ?? null,
    eventType: h.EventType as string,
    updateKey: (h.UpdateKey as string | null) ?? null,
    title: (h.Title as string | null) ?? null,
    category: (h.Category as string | null) ?? null,
    detail: (h.Detail as string | null) ?? null,
    actor: (h.ActorName as string | null) ?? null,
    requestId: (h.RequestId as number | null) ?? null,
    incidentNumber: (h.IncidentNumber as string | null) ?? null,
    createdAt: h.CreatedAt as string,
  };
}
