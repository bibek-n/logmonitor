import { getDb, sql } from "@/lib/db";
import type OpenAI from "openai";
import type { ToolHandler } from "./shared";

// New tools the 6 AI Modules need that src/lib/aiAssistant/tools.ts doesn't already provide
// (that file's 22 tools cover aggregate/top-N views; these are per-device/targeted lookups plus
// two data sources - ServerLogEntries and WebFilterLogs - the AI Assistant doesn't touch at
// all). Same deliberate constraint as that file: fixed, hand-written, parameterized queries
// only, never raw/model-generated SQL.

async function resolveDeviceId(deviceName: string): Promise<string | null> {
  const db = await getDb();
  const result = await db
    .request()
    .input("name", sql.NVarChar, deviceName)
    .query<{ DeviceId: string }>(`
      SELECT TOP 1 DeviceId FROM Devices
      WHERE DeviceName = @name OR Hostname = @name OR DeviceName LIKE '%' + @name + '%' OR Hostname LIKE '%' + @name + '%'
      ORDER BY CASE WHEN DeviceName = @name OR Hostname = @name THEN 0 ELSE 1 END
    `);
  return result.recordset[0]?.DeviceId ?? null;
}

async function getDeviceMetricsHistory(input: { deviceName: string; hours?: number }) {
  if (!input.deviceName) throw new Error("deviceName is required");
  const deviceId = await resolveDeviceId(input.deviceName);
  if (!deviceId) return { message: `No device found matching "${input.deviceName}".` };

  const hours = Math.min(72, Math.max(1, input.hours ?? 6));
  const db = await getDb();
  const result = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("hours", sql.Int, hours)
    .query<{
      ReceivedAt: string;
      CpuPct: number | null;
      MemPct: number | null;
      DiskPct: number | null;
      NetRxMbps: number | null;
      NetTxMbps: number | null;
      UptimeSeconds: string | null;
    }>(`
      SELECT CONVERT(VARCHAR(19), ReceivedAt, 126) AS ReceivedAt, CpuPct, MemPct, DiskPct, NetRxMbps, NetTxMbps, UptimeSeconds
      FROM DeviceMetrics
      WHERE DeviceId = @deviceId AND ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME())
      ORDER BY ReceivedAt ASC
    `);

  if (result.recordset.length === 0) {
    return { message: `No metrics recorded for this device in the last ${hours} hours.` };
  }

  // Uptime resets are the clearest machine-readable signal of an unplanned reboot/crash in this
  // series, so flagged explicitly rather than left for the model to notice in a raw number list.
  const samples = result.recordset;
  const rebootDetected = samples.some((s, i) => {
    if (i === 0 || !s.UptimeSeconds || !samples[i - 1].UptimeSeconds) return false;
    return Number(s.UptimeSeconds) < Number(samples[i - 1].UptimeSeconds);
  });

  return { windowHours: hours, sampleCount: samples.length, rebootDetectedInWindow: rebootDetected, samples };
}

const VALID_LOG_SOURCES = ["apache_access", "apache_error", "nginx_access", "nginx_error", "mysql", "php", "system", "eventlog", "mssql", "mssql_slow"];
const ERROR_SEVERITIES = ["error", "critical", "warning", "warn"];

async function getServerLogs(input: { deviceName: string; logSource?: string; hours?: number; errorsOnly?: boolean; limit?: number }) {
  if (!input.deviceName) throw new Error("deviceName is required");
  const deviceId = await resolveDeviceId(input.deviceName);
  if (!deviceId) return { message: `No device found matching "${input.deviceName}".` };

  const hours = Math.min(168, Math.max(1, input.hours ?? 24));
  const limit = Math.min(100, Math.max(1, input.limit ?? 40));
  const logSource = input.logSource && VALID_LOG_SOURCES.includes(input.logSource) ? input.logSource : null;

  const db = await getDb();
  const req = db.request().input("deviceId", sql.VarChar, deviceId).input("hours", sql.Int, hours);
  let where = "DeviceId = @deviceId AND ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME())";
  if (logSource) {
    req.input("logSource", sql.VarChar, logSource);
    where += " AND LogSource = @logSource";
  }
  if (input.errorsOnly) {
    req.input("sev0", sql.VarChar, ERROR_SEVERITIES[0]);
    req.input("sev1", sql.VarChar, ERROR_SEVERITIES[1]);
    req.input("sev2", sql.VarChar, ERROR_SEVERITIES[2]);
    req.input("sev3", sql.VarChar, ERROR_SEVERITIES[3]);
    where += " AND Severity IN (@sev0, @sev1, @sev2, @sev3)";
  }

  const result = await req.query<{ ReceivedAt: string; LogSource: string; Severity: string | null; Message: string | null }>(`
    SELECT TOP ${limit} CONVERT(VARCHAR(19), ReceivedAt, 126) AS ReceivedAt, LogSource, Severity, Message
    FROM ServerLogEntries
    WHERE ${where}
    ORDER BY ReceivedAt DESC
  `);

  if (result.recordset.length === 0) {
    return { message: `No matching log entries for this device in the last ${hours} hours.` };
  }
  return {
    windowHours: hours,
    entryCount: result.recordset.length,
    entries: result.recordset.map((r) => ({ at: r.ReceivedAt, source: r.LogSource, severity: r.Severity, message: r.Message })),
  };
}

async function getDeviceSecurityStatus(input: { deviceName: string }) {
  if (!input.deviceName) throw new Error("deviceName is required");
  const deviceId = await resolveDeviceId(input.deviceName);
  if (!deviceId) return { message: `No device found matching "${input.deviceName}".` };

  const db = await getDb();
  const result = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .query<{
      AntivirusStatus: string | null;
      DefenderStatus: string | null;
      FirewallEnabled: boolean | null;
      FirewallRulesCount: number | null;
      BitLockerStatus: string | null;
      SecureBootEnabled: boolean | null;
      TpmVersion: string | null;
      FailedLoginCount24h: number | null;
      LastScanAt: string | null;
    }>(`
      SELECT AntivirusStatus, DefenderStatus, FirewallEnabled, FirewallRulesCount, BitLockerStatus,
        SecureBootEnabled, TpmVersion, FailedLoginCount24h, CONVERT(VARCHAR(19), LastScanAt, 126) AS LastScanAt
      FROM DeviceSecurityStatus WHERE DeviceId = @deviceId
    `);

  const r = result.recordset[0];
  if (!r) return { message: "No security status data collected for this device yet." };
  return {
    antivirus: r.AntivirusStatus,
    defender: r.DefenderStatus,
    firewallEnabled: r.FirewallEnabled,
    firewallRulesCount: r.FirewallRulesCount,
    bitLocker: r.BitLockerStatus,
    secureBootEnabled: r.SecureBootEnabled,
    tpmVersion: r.TpmVersion,
    failedLoginCount24h: r.FailedLoginCount24h,
    lastScanAt: r.LastScanAt,
  };
}

async function getDeviceNetworkInfo(input: { deviceName: string }) {
  if (!input.deviceName) throw new Error("deviceName is required");
  const deviceId = await resolveDeviceId(input.deviceName);
  if (!deviceId) return { message: `No device found matching "${input.deviceName}".` };

  const db = await getDb();
  const result = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .query<{
      CurrentIp: string | null;
      PublicIp: string | null;
      GatewayIp: string | null;
      DnsServers: string | null;
      WifiSsid: string | null;
      VpnActive: boolean | null;
      EthernetConnected: boolean | null;
      OpenPortsJson: string | null;
      ListeningPortsJson: string | null;
    }>(`
      SELECT CurrentIp, PublicIp, GatewayIp, DnsServers, WifiSsid, VpnActive, EthernetConnected, OpenPortsJson, ListeningPortsJson
      FROM DeviceNetworkInfo WHERE DeviceId = @deviceId
    `);

  const r = result.recordset[0];
  if (!r) return { message: "No network info collected for this device yet." };

  const parseJsonArray = (raw: string | null): unknown[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  return {
    currentIp: r.CurrentIp,
    publicIp: r.PublicIp,
    gatewayIp: r.GatewayIp,
    dnsServers: r.DnsServers,
    wifiSsid: r.WifiSsid,
    vpnActive: r.VpnActive,
    ethernetConnected: r.EthernetConnected,
    openPorts: parseJsonArray(r.OpenPortsJson),
    listeningPorts: parseJsonArray(r.ListeningPortsJson),
  };
}

async function getRecentWebFilterActivity(input: { hours?: number; limit?: number }) {
  const hours = Math.min(168, Math.max(1, input.hours ?? 24));
  const limit = Math.min(20, Math.max(1, input.limit ?? 10));
  const db = await getDb();
  const req = db.request().input("hours", sql.Int, hours);

  const [categoryResult, applicationResult] = await Promise.all([
    req.query<{ Category: string; Cnt: number }>(`
      SELECT TOP ${limit} COALESCE(NULLIF(Category, ''), 'Uncategorized') AS Category, COUNT(*) AS Cnt
      FROM WebFilterLogs WHERE ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME())
      GROUP BY COALESCE(NULLIF(Category, ''), 'Uncategorized')
      ORDER BY COUNT(*) DESC
    `),
    db
      .request()
      .input("hours", sql.Int, hours)
      .query<{ Domain: string; Cnt: number; SrcIpCount: number }>(`
        SELECT TOP ${limit} Domain, COUNT(*) AS Cnt, COUNT(DISTINCT SrcIp) AS SrcIpCount
        FROM WebFilterLogs
        WHERE ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME()) AND Domain IS NOT NULL AND Domain <> ''
        GROUP BY Domain
        ORDER BY COUNT(*) DESC
      `),
  ]);

  return {
    windowHours: hours,
    topCategories: categoryResult.recordset.map((r) => ({ category: r.Category, requestCount: r.Cnt })),
    topDomains: applicationResult.recordset.map((r) => ({ domain: r.Domain, requestCount: r.Cnt, distinctSourceIps: r.SrcIpCount })),
  };
}

export const EXTRA_TOOL_HANDLERS: Record<string, ToolHandler> = {
  get_device_metrics_history: getDeviceMetricsHistory,
  get_server_logs: getServerLogs,
  get_device_security_status: getDeviceSecurityStatus,
  get_device_network_info: getDeviceNetworkInfo,
  get_recent_web_filter_activity: getRecentWebFilterActivity,
};

export const EXTRA_TOOL_DEFINITIONS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_device_metrics_history",
      description: "Get a specific device's CPU/memory/disk/network metric history over a time window, and whether an uptime reset (unplanned reboot/crash) was detected in that window.",
      parameters: {
        type: "object",
        properties: {
          deviceName: { type: "string", description: "Device name or hostname (partial match allowed)." },
          hours: { type: "number", description: "How many hours of history to look at (default 6, max 72)." },
        },
        required: ["deviceName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_server_logs",
      description: "Get recent raw log entries shipped from a specific server/device (nginx, apache, mysql, php, system, Windows event log, mssql).",
      parameters: {
        type: "object",
        properties: {
          deviceName: { type: "string", description: "Device name or hostname (partial match allowed)." },
          logSource: { type: "string", description: `One of: ${VALID_LOG_SOURCES.join(", ")}. Omit to include all sources.` },
          hours: { type: "number", description: "How many hours of history to look at (default 24, max 168)." },
          errorsOnly: { type: "boolean", description: "If true, only return error/critical/warning severity entries." },
          limit: { type: "number", description: "Max entries to return (default 40, max 100)." },
        },
        required: ["deviceName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_device_security_status",
      description: "Get a specific device's endpoint security posture: antivirus/Defender status, firewall, BitLocker, Secure Boot, TPM, and recent failed login count.",
      parameters: {
        type: "object",
        properties: {
          deviceName: { type: "string", description: "Device name or hostname (partial match allowed)." },
        },
        required: ["deviceName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_device_network_info",
      description: "Get a specific device's network configuration: current/public/gateway IP, DNS servers, WiFi SSID, VPN status, and open/listening ports.",
      parameters: {
        type: "object",
        properties: {
          deviceName: { type: "string", description: "Device name or hostname (partial match allowed)." },
        },
        required: ["deviceName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_web_filter_activity",
      description: "Get the top web-filter categories and most-visited domains across the whole network in a recent time window - useful for spotting unusual spikes or patterns.",
      parameters: {
        type: "object",
        properties: {
          hours: { type: "number", description: "How many hours of history to look at (default 24, max 168)." },
          limit: { type: "number", description: "Max categories/domains to return (default 10, max 20)." },
        },
      },
    },
  },
];
