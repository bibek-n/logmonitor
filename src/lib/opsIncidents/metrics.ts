import { getDb } from "../db";

export interface MttaMttrOverall {
  mttaMinutes: number | null;
  mttrMinutes: number | null;
  acknowledgedCount: number;
  resolvedCount: number;
}
export interface MttaMttrByMonth {
  month: string; // "YYYY-MM"
  mttaMinutes: number | null;
  mttrMinutes: number | null;
}
export interface MttaMttrByPerson {
  username: string;
  mttaMinutes: number | null;
  acknowledgedCount: number;
  mttrMinutes: number | null;
  resolvedCount: number;
}

export interface MttaMttrReport {
  overall: MttaMttrOverall;
  byMonth: MttaMttrByMonth[];
  byPerson: MttaMttrByPerson[];
}

// MTTA is measured against whoever actually acknowledged (AcknowledgedByUserId), MTTR against
// whoever actually resolved (ResolvedByUserId) - the spec's "per person" most naturally means
// whoever performed that specific action, not necessarily the incident's overall owner (the
// owner might delegate the actual ack/resolve to someone else). Grouped over the last N months
// of StartedAt; an incident still open/unresolved simply doesn't contribute to that half of
// the average (a DATEDIFF against a NULL ResolvedAt would otherwise need excluding anyway).
export async function getMttaMttrReport(months = 6): Promise<MttaMttrReport> {
  const db = await getDb();

  const overallResult = await db.query<{ MttaMinutes: number | null; MttrMinutes: number | null; AckCount: number; ResolvedCount: number }>(`
    SELECT
      AVG(CASE WHEN AcknowledgedAt IS NOT NULL THEN CAST(DATEDIFF(MINUTE, StartedAt, AcknowledgedAt) AS FLOAT) END) AS MttaMinutes,
      AVG(CASE WHEN ResolvedAt IS NOT NULL THEN CAST(DATEDIFF(MINUTE, StartedAt, ResolvedAt) AS FLOAT) END) AS MttrMinutes,
      SUM(CASE WHEN AcknowledgedAt IS NOT NULL THEN 1 ELSE 0 END) AS AckCount,
      SUM(CASE WHEN ResolvedAt IS NOT NULL THEN 1 ELSE 0 END) AS ResolvedCount
    FROM OpsIncidents
    WHERE StartedAt >= DATEADD(MONTH, -${Math.max(1, Math.min(24, months))}, SYSUTCDATETIME())
  `);
  const o = overallResult.recordset[0];

  const byMonthResult = await db.query<{ Month: string; MttaMinutes: number | null; MttrMinutes: number | null }>(`
    SELECT CONVERT(VARCHAR(7), StartedAt, 126) AS Month,
      AVG(CASE WHEN AcknowledgedAt IS NOT NULL THEN CAST(DATEDIFF(MINUTE, StartedAt, AcknowledgedAt) AS FLOAT) END) AS MttaMinutes,
      AVG(CASE WHEN ResolvedAt IS NOT NULL THEN CAST(DATEDIFF(MINUTE, StartedAt, ResolvedAt) AS FLOAT) END) AS MttrMinutes
    FROM OpsIncidents
    WHERE StartedAt >= DATEADD(MONTH, -${Math.max(1, Math.min(24, months))}, SYSUTCDATETIME())
    GROUP BY CONVERT(VARCHAR(7), StartedAt, 126)
    ORDER BY Month ASC
  `);

  const byAckPersonResult = await db.query<{ Username: string; MttaMinutes: number | null; AckCount: number }>(`
    SELECT u.Username, AVG(CAST(DATEDIFF(MINUTE, i.StartedAt, i.AcknowledgedAt) AS FLOAT)) AS MttaMinutes, COUNT(*) AS AckCount
    FROM OpsIncidents i JOIN Users u ON u.Id = i.AcknowledgedByUserId
    WHERE i.AcknowledgedAt IS NOT NULL AND i.StartedAt >= DATEADD(MONTH, -${Math.max(1, Math.min(24, months))}, SYSUTCDATETIME())
    GROUP BY u.Username
  `);
  const byResolvePersonResult = await db.query<{ Username: string; MttrMinutes: number | null; ResolvedCount: number }>(`
    SELECT u.Username, AVG(CAST(DATEDIFF(MINUTE, i.StartedAt, i.ResolvedAt) AS FLOAT)) AS MttrMinutes, COUNT(*) AS ResolvedCount
    FROM OpsIncidents i JOIN Users u ON u.Id = i.ResolvedByUserId
    WHERE i.ResolvedAt IS NOT NULL AND i.StartedAt >= DATEADD(MONTH, -${Math.max(1, Math.min(24, months))}, SYSUTCDATETIME())
    GROUP BY u.Username
  `);

  const byPersonMap = new Map<string, MttaMttrByPerson>();
  for (const r of byAckPersonResult.recordset) {
    byPersonMap.set(r.Username, { username: r.Username, mttaMinutes: r.MttaMinutes, acknowledgedCount: r.AckCount, mttrMinutes: null, resolvedCount: 0 });
  }
  for (const r of byResolvePersonResult.recordset) {
    const existing = byPersonMap.get(r.Username);
    if (existing) {
      existing.mttrMinutes = r.MttrMinutes;
      existing.resolvedCount = r.ResolvedCount;
    } else {
      byPersonMap.set(r.Username, { username: r.Username, mttaMinutes: null, acknowledgedCount: 0, mttrMinutes: r.MttrMinutes, resolvedCount: r.ResolvedCount });
    }
  }

  return {
    overall: { mttaMinutes: o.MttaMinutes, mttrMinutes: o.MttrMinutes, acknowledgedCount: o.AckCount, resolvedCount: o.ResolvedCount },
    byMonth: byMonthResult.recordset.map((r) => ({ month: r.Month, mttaMinutes: r.MttaMinutes, mttrMinutes: r.MttrMinutes })),
    byPerson: [...byPersonMap.values()].sort((a, b) => b.acknowledgedCount + b.resolvedCount - (a.acknowledgedCount + a.resolvedCount)),
  };
}
