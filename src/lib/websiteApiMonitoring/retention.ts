import { getDb, sql } from "../db";

// A plain DELETE past the configured retention window - not the full raw/5-minute/hourly/
// daily aggregation pipeline from spec section 24 (that's Phase 4's "metric aggregation
// worker"). Incident history is never touched here, only MonitorResults (spec section 24:
// "do not remove incident history when raw check results are cleaned up").
export async function pruneOldResults(): Promise<number> {
  const db = await getDb();
  const settings = await db.query<{ DataRetentionDays: number }>("SELECT DataRetentionDays FROM MonitoringSettings WHERE Id = 1");
  const retentionDays = settings.recordset[0]?.DataRetentionDays ?? 90;

  const result = await db
    .request()
    .input("retentionDays", sql.Int, retentionDays)
    .query("DELETE FROM MonitorResults WHERE CheckedAt < DATEADD(DAY, -@retentionDays, SYSUTCDATETIME())");
  return result.rowsAffected[0] ?? 0;
}
