import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_incidents_view");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, Number(id)).query(`
    SELECT i.*, CONVERT(VARCHAR(33), i.StartedAt, 126) AS StartedAtFormatted,
      CONVERT(VARCHAR(33), i.ResolvedAt, 126) AS ResolvedAtFormatted,
      m.Name AS MonitorName, m.MonitorType
    FROM Incidents i
    JOIN Monitors m ON m.Id = i.MonitorId
    WHERE i.Id = @id
  `);
  const incident = result.recordset[0];
  if (!incident) return NextResponse.json({ ok: false, error: "Incident not found" }, { status: 404 });

  return NextResponse.json({ ok: true, data: incident });
}
