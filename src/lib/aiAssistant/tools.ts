import { getDb, sql } from "@/lib/db";
import type { OpenAI } from "openai";
import { EXPANSION_TOOL_HANDLERS, EXPANSION_TOOL_DEFINITIONS } from "./toolsExpansion";

// The AI Assistant never gets raw SQL access or a free-text query tool - every question is
// answered by calling one of this fixed, hand-written set of read-only functions, each doing
// exactly one parameterized query against tables this app already owns. This is deliberate:
// letting a model generate SQL against a production database (even read-only) is a real
// injection/data-exposure surface for no real benefit here, since the whole point of this
// feature is a small, known set of ops questions - a fixed toolset covers that with zero risk
// of the model wandering into a table/column it shouldn't touch or crafting an expensive query.

// Same 90s heartbeat-staleness threshold as src/lib/remoteSupport/presence.ts's
// isDeviceOnline - not reused directly to avoid a cross-feature import for one constant, but
// must be kept in sync if that threshold ever changes.
const ONLINE_THRESHOLD_MS = 90 * 1000;

export interface ToolResult {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
}

async function getTopCpuUsage(input: { limit?: number }) {
  const db = await getDb();
  const limit = Math.min(20, Math.max(1, input.limit ?? 5));
  const result = await db.query<{
    DeviceName: string | null;
    Hostname: string;
    DeviceType: string;
    CpuPct: number | null;
    ReceivedAt: string;
  }>(`
    SELECT TOP ${limit} d.DeviceName, d.Hostname, d.DeviceType, m.CpuPct, CONVERT(VARCHAR(19), m.ReceivedAt, 126) AS ReceivedAt
    FROM Devices d
    CROSS APPLY (
      SELECT TOP 1 CpuPct, ReceivedAt FROM DeviceMetrics
      WHERE DeviceId = d.DeviceId AND ReceivedAt >= DATEADD(HOUR, -24, SYSUTCDATETIME())
      ORDER BY CpuPct DESC
    ) m
    ORDER BY m.CpuPct DESC
  `);
  return result.recordset.map((r) => ({
    device: r.DeviceName ?? r.Hostname,
    type: r.DeviceType,
    cpuPercent: r.CpuPct,
    sampledAt: r.ReceivedAt,
  }));
}

export async function getOfflineDevices(input: { withinDays?: number }) {
  const db = await getDb();
  const withinDays = Math.min(30, Math.max(1, input.withinDays ?? 7));
  const result = await db
    .request()
    .input("withinDays", sql.Int, withinDays)
    .query<{ DeviceName: string | null; Hostname: string; DeviceType: string; LastHeartbeat: string | null }>(`
      SELECT DeviceName, Hostname, DeviceType, CONVERT(VARCHAR(19), LastHeartbeat, 126) AS LastHeartbeat
      FROM Devices
      WHERE LastHeartbeat IS NULL OR LastHeartbeat < DATEADD(SECOND, -90, SYSUTCDATETIME())
      ORDER BY LastHeartbeat DESC
    `);
  // Filtered/annotated in JS rather than SQL so the "currently offline, last seen within N
  // days" vs "offline and hasn't been seen in longer than that" distinction is explicit in the
  // output the model reasons over, rather than silently dropping the long-dead ones.
  const now = Date.now();
  return result.recordset
    .filter((r) => !r.LastHeartbeat || now - new Date(r.LastHeartbeat).getTime() <= withinDays * 86400000)
    .map((r) => ({
      device: r.DeviceName ?? r.Hostname,
      type: r.DeviceType,
      lastHeartbeat: r.LastHeartbeat,
      currentlyOffline: !r.LastHeartbeat || now - new Date(r.LastHeartbeat).getTime() >= ONLINE_THRESHOLD_MS,
    }));
}

async function getBandwidthSummary(input: { hours?: number }) {
  const db = await getDb();
  const hours = Math.min(72, Math.max(1, input.hours ?? 4));

  const recentResult = await db
    .request()
    .input("hours", sql.Int, hours)
    .query<{ Interface: string; RxMbps: number | null; TxMbps: number | null; ReceivedAt: string }>(`
      SELECT Interface, RxMbps, TxMbps, CONVERT(VARCHAR(19), ReceivedAt, 126) AS ReceivedAt
      FROM RouterBandwidth WHERE ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME())
      ORDER BY ReceivedAt ASC
    `);

  const baselineResult = await db.query<{ Interface: string; AvgRx: number | null; AvgTx: number | null }>(`
    SELECT Interface, AVG(RxMbps) AS AvgRx, AVG(TxMbps) AS AvgTx
    FROM RouterBandwidth WHERE ReceivedAt >= DATEADD(DAY, -7, SYSUTCDATETIME())
    GROUP BY Interface
  `);

  // Top per-device network consumers in the same window, so a "why is bandwidth high" question
  // can point at a specific device rather than just confirming the router-level number is
  // elevated.
  const topConsumersResult = await db
    .request()
    .input("hours", sql.Int, hours)
    .query<{ DeviceName: string | null; Hostname: string; MaxRx: number | null; MaxTx: number | null }>(`
      SELECT TOP 5 d.DeviceName, d.Hostname, MAX(m.NetRxMbps) AS MaxRx, MAX(m.NetTxMbps) AS MaxTx
      FROM DeviceMetrics m
      JOIN Devices d ON d.DeviceId = m.DeviceId
      WHERE m.ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME())
      GROUP BY d.DeviceName, d.Hostname
      ORDER BY MAX(m.NetRxMbps + m.NetTxMbps) DESC
    `);

  return {
    windowHours: hours,
    recentSamples: recentResult.recordset,
    sevenDayBaselinePerInterface: baselineResult.recordset,
    topDeviceConsumers: topConsumersResult.recordset.map((r) => ({
      device: r.DeviceName ?? r.Hostname,
      maxRxMbps: r.MaxRx,
      maxTxMbps: r.MaxTx,
    })),
  };
}

export async function getExpiringSslCertificates(input: { withinDays?: number }) {
  const db = await getDb();
  const withinDays = Math.min(180, Math.max(1, input.withinDays ?? 30));
  const result = await db
    .request()
    .input("withinDays", sql.Int, withinDays)
    .query<{ DeviceName: string | null; SiteName: string; SslExpiresAt: string | null }>(`
      SELECT d.DeviceName, s.SiteName, CONVERT(VARCHAR(19), s.SslExpiresAt, 126) AS SslExpiresAt
      FROM IisSites s
      JOIN Devices d ON d.DeviceId = s.DeviceId
      WHERE s.SslExpiresAt IS NOT NULL AND s.SslExpiresAt <= DATEADD(DAY, @withinDays, SYSUTCDATETIME())
      ORDER BY s.SslExpiresAt ASC
    `);
  return result.recordset.map((r) => ({
    server: r.DeviceName,
    site: r.SiteName,
    expiresAt: r.SslExpiresAt,
    alreadyExpired: r.SslExpiresAt ? new Date(r.SslExpiresAt).getTime() < Date.now() : false,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolHandler = (input: any) => Promise<unknown>;

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  get_top_cpu_usage: getTopCpuUsage,
  get_offline_devices: getOfflineDevices,
  get_bandwidth_summary: getBandwidthSummary,
  get_expiring_ssl_certificates: getExpiringSslCertificates,
  // Everything covering modules beyond Devices/router bandwidth/IIS certs lives in
  // toolsExpansion.ts, merged in here so callers (assistant.ts) only ever need this one export.
  ...EXPANSION_TOOL_HANDLERS,
};

// OpenAI-shaped function-calling tool definitions (GitHub Models exposes an OpenAI-compatible
// chat.completions API - see assistant.ts) - kept alongside TOOL_HANDLERS so the schema and its
// implementation can never drift apart silently (a new tool always needs both, added in the
// same place).
export const TOOL_DEFINITIONS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_top_cpu_usage",
      description: "Get the devices (servers/workstations) with the highest CPU usage in the last 24 hours, highest first.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "How many top devices to return (default 5, max 20)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_offline_devices",
      description: "Get devices that are currently offline (no heartbeat received) and were last seen within a given number of days.",
      parameters: {
        type: "object",
        properties: {
          withinDays: { type: "number", description: "Only include devices last seen within this many days (default 7, max 30)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_bandwidth_summary",
      description:
        "Get recent internet bandwidth (Mbps) samples, a 7-day baseline average for comparison, and the top individual devices by network usage in the window - use this to explain why bandwidth is high or low.",
      parameters: {
        type: "object",
        properties: {
          hours: { type: "number", description: "How many hours of recent history to look at (default 4, max 72)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_expiring_ssl_certificates",
      description: "Get IIS-hosted website SSL certificates expiring within a given number of days (includes already-expired ones).",
      parameters: {
        type: "object",
        properties: {
          withinDays: { type: "number", description: "Only include certificates expiring within this many days (default 30, max 180)." },
        },
      },
    },
  },
  ...EXPANSION_TOOL_DEFINITIONS,
];
