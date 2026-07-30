import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";

// DDoS Detection is a focused view over the same SecurityEvents/SecurityAlerts data the
// Intrusion Detection module already collects - not a separate collection pipeline. It
// narrows "Requests/sec" to raw event volume (any source), and "Top Attackers" specifically
// to the two categories the rule engine already tags as flood/automation-shaped
// (high_request_rate, bot_activity) rather than every alert category, so a slow-scan port
// probe doesn't crowd out an actual volumetric attacker.
const DDOS_CATEGORIES = ["high_request_rate", "bot_activity"] as const;
const ALLOWED_HOURS = [4, 24, 168];

interface RequestBucket {
  bucket: string;
  count: number;
}

interface TopAttacker {
  ip: string;
  alertCount: number;
  totalOccurrences: number;
  severityRank: number;
  lastSeenAt: string;
}

interface TimelineAlertEntry {
  type: "alert";
  id: number;
  category: string;
  severity: string;
  sourceIp: string | null;
  requestPath: string | null;
  occurrenceCount: number;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface TimelineBlockEntry {
  type: "block" | "unblock";
  id: number;
  ipOrCidr: string;
  reason: string | null;
  at: string;
}

export async function GET(req: NextRequest) {
  const session = await requireSecurityRole("viewer");
  if (!isSecuritySession(session)) return session;

  const hoursParam = Number(req.nextUrl.searchParams.get("hours"));
  const hours = ALLOWED_HOURS.includes(hoursParam) ? hoursParam : 24;

  const db = await getDb();
  const categoryList = DDOS_CATEGORIES.map((c) => `'${c}'`).join(",");
  // Coarser buckets for longer windows - a 7-day view at per-minute resolution would be
  // thousands of points; per-minute (VARCHAR(16) of style 126, "yyyy-mm-ddThh:mi") only makes
  // sense for the 4h window, per-hour (VARCHAR(13), "yyyy-mm-ddThh") for 24h/7d.
  const bucketExpr = hours <= 4 ? "CONVERT(VARCHAR(16), EventTime, 126)" : "CONVERT(VARCHAR(13), EventTime, 126)";

  const [requestBuckets, perServerRequestRates, topAttackers, alertTimeline, blockTimeline] = await Promise.all([
    db.query<RequestBucket>(`
      SELECT ${bucketExpr} AS bucket, COUNT(*) AS count
      FROM SecurityEvents
      WHERE EventTime >= DATEADD(HOUR, -${hours}, SYSUTCDATETIME())
      GROUP BY ${bucketExpr}
      ORDER BY bucket ASC
    `),
    // SecurityEvents only ever reflects whatever log sources are actually configured (today,
    // just this app's own IIS logs - see the module's page copy for why per-website/per-server
    // log ingestion isn't wired up yet). Every IIS-detected server's endpoint agent already
    // reports its own request rate independently of that pipeline, so this gives genuine
    // per-server "requests/sec" coverage today without needing new collection infrastructure.
    db.query<{ deviceId: string; deviceName: string | null; hostname: string; requestsPerSec: number | null; connections: number | null; receivedAt: string }>(`
      WITH Latest AS (
        SELECT p.DeviceId, p.WebServiceRequestsPerSec, p.CurrentConnections, p.ReceivedAt,
          ROW_NUMBER() OVER (PARTITION BY p.DeviceId ORDER BY p.ReceivedAt DESC) AS rn
        FROM IisPerfSnapshots p
        WHERE p.ReceivedAt >= DATEADD(HOUR, -${hours}, SYSUTCDATETIME())
      )
      SELECT d.DeviceId AS deviceId, d.DeviceName AS deviceName, d.Hostname AS hostname,
        l.WebServiceRequestsPerSec AS requestsPerSec, l.CurrentConnections AS connections,
        CONVERT(VARCHAR(19), l.ReceivedAt, 126) AS receivedAt
      FROM Latest l
      JOIN Devices d ON d.DeviceId = l.DeviceId
      WHERE l.rn = 1
      ORDER BY l.WebServiceRequestsPerSec DESC
    `),
    db.query<TopAttacker>(`
      SELECT TOP 20 SourceIp AS ip, COUNT(*) AS alertCount, SUM(OccurrenceCount) AS totalOccurrences,
        MAX(CASE Severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END) AS severityRank,
        CONVERT(VARCHAR(19), MAX(LastSeenAt), 126) AS lastSeenAt
      FROM SecurityAlerts
      WHERE Category IN (${categoryList}) AND SourceIp IS NOT NULL AND CreatedAt >= DATEADD(HOUR, -${hours}, SYSUTCDATETIME())
      GROUP BY SourceIp
      ORDER BY totalOccurrences DESC
    `),
    db.query<TimelineAlertEntry>(`
      SELECT TOP 50 Id AS id, Category AS category, Severity AS severity, SourceIp AS sourceIp, RequestPath AS requestPath,
        OccurrenceCount AS occurrenceCount, Status AS status,
        CONVERT(VARCHAR(19), FirstSeenAt, 126) AS firstSeenAt, CONVERT(VARCHAR(19), LastSeenAt, 126) AS lastSeenAt
      FROM SecurityAlerts
      WHERE Category IN (${categoryList}) AND CreatedAt >= DATEADD(HOUR, -${hours}, SYSUTCDATETIME())
      ORDER BY LastSeenAt DESC
    `),
    db.query<{ id: number; ipOrCidr: string; reason: string | null; isActive: boolean; at: string }>(`
      SELECT Id AS id, IpOrCidr AS ipOrCidr, Reason AS reason, IsActive AS isActive, CONVERT(VARCHAR(19), CreatedAt, 126) AS at
      FROM SecurityIpBlocklist
      WHERE CreatedAt >= DATEADD(HOUR, -${hours}, SYSUTCDATETIME())
      ORDER BY CreatedAt DESC
    `),
  ]);

  const timeline: (TimelineAlertEntry | TimelineBlockEntry)[] = [
    ...alertTimeline.recordset.map((a) => ({ ...a, type: "alert" as const })),
    ...blockTimeline.recordset.map((b) => ({
      type: "block" as const,
      id: b.id,
      ipOrCidr: b.ipOrCidr,
      reason: b.reason,
      at: b.at,
    })),
  ].sort((a, b) => {
    const timeA = a.type === "alert" ? a.lastSeenAt : a.at;
    const timeB = b.type === "alert" ? b.lastSeenAt : b.at;
    return timeB.localeCompare(timeA);
  });

  return NextResponse.json({
    ok: true,
    data: {
      requestBuckets: requestBuckets.recordset,
      perServerRequestRates: perServerRequestRates.recordset,
      topAttackers: topAttackers.recordset,
      timeline: timeline.slice(0, 50),
    },
  });
}
