import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";

// Per-website security summary - separate from the raw Alerts/Events tabs (which mix every
// protected application together) and separate from the Websites tab (which manages the
// list, not results). One row per website synced in from the Websites list, with enough at a
// glance to tell "is this site quiet or does it need attention" without opening each alert.
export async function GET() {
  const session = await requireSecurityRole("viewer");
  if (!isSecuritySession(session)) return session;

  const db = await getDb();
  const result = await db.query(`
    SELECT
      pa.Id AS AppId,
      pa.Name AS WebsiteName,
      w.Url,
      w.Enabled,
      (SELECT COUNT(*) FROM SecurityEvents e WHERE e.ProtectedApplicationId = pa.Id) AS EventCount,
      (SELECT COUNT(*) FROM SecurityAlerts a WHERE a.ProtectedApplicationId = pa.Id) AS AlertCount,
      (SELECT COUNT(*) FROM SecurityAlerts a WHERE a.ProtectedApplicationId = pa.Id AND a.Severity = 'critical') AS CriticalCount,
      (SELECT COUNT(*) FROM SecurityAlerts a WHERE a.ProtectedApplicationId = pa.Id AND a.Severity = 'high') AS HighCount,
      (SELECT COUNT(*) FROM SecurityAlerts a WHERE a.ProtectedApplicationId = pa.Id AND a.Status NOT IN ('Resolved','FalsePositive')) AS OpenAlertCount,
      (SELECT CONVERT(VARCHAR(19), MAX(e.EventTime), 126) FROM SecurityEvents e WHERE e.ProtectedApplicationId = pa.Id) AS LastEventAt,
      (SELECT CONVERT(VARCHAR(19), MAX(a.CreatedAt), 126) FROM SecurityAlerts a WHERE a.ProtectedApplicationId = pa.Id) AS LastAlertAt
    FROM SecurityProtectedApplications pa
    JOIN Websites w ON w.Id = pa.WebsiteId
    WHERE pa.WebsiteId IS NOT NULL
    ORDER BY pa.Name
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}
