import { NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { getSlaPeriodStart, SlaWindow } from "@/lib/websiteApiMonitoring/slaEvaluator";

interface SlaRow {
  MonitorId: number;
  MonitorName: string;
  MonitorType: string;
  TargetPercent: number;
  EvaluationWindow: SlaWindow;
}

// Every monitor with SLA tracking configured, plus its live current-period uptime % computed
// the same way slaEvaluator.ts's scan-time breach check does - so what an admin sees here is
// exactly what decides whether an alert fires, not a separately-computed number that could
// disagree with it.
export async function GET() {
  const mon = await requireMonitoringPermission("mon_view");
  if (!isMonitoringSession(mon)) return mon;

  const db = await getDb();
  const configs = await db.query<SlaRow>(`
    SELECT s.MonitorId, m.Name AS MonitorName, m.MonitorType, s.TargetPercent, s.EvaluationWindow
    FROM SlaConfigurations s
    JOIN Monitors m ON m.Id = s.MonitorId AND m.IsDeleted = 0
    ORDER BY m.Name ASC
  `);

  const now = new Date();
  const data = [];
  for (const row of configs.recordset) {
    const periodStart = getSlaPeriodStart(row.EvaluationWindow, now);
    const uptime = await db
      .request()
      .input("id", sql.Int, row.MonitorId)
      .input("start", sql.DateTime2, periodStart)
      .query<{ Total: number; Successful: number }>(
        "SELECT COUNT(*) AS Total, SUM(CASE WHEN Success = 1 THEN 1 ELSE 0 END) AS Successful FROM MonitorResults WHERE MonitorId = @id AND CheckedAt >= @start"
      );
    const u = uptime.recordset[0];
    const actualPercent = u.Total > 0 ? (u.Successful / u.Total) * 100 : null;
    data.push({
      monitorId: row.MonitorId,
      monitorName: row.MonitorName,
      monitorType: row.MonitorType,
      targetPercent: row.TargetPercent,
      evaluationWindow: row.EvaluationWindow,
      periodStart: periodStart.toISOString(),
      actualPercent,
      breached: actualPercent !== null && actualPercent < row.TargetPercent,
    });
  }

  return NextResponse.json({ ok: true, data });
}
