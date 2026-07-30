import { getDb, sql } from "../db";

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
// Bounds how many buckets a single aggregation pass will backfill for one monitor - a monitor
// that somehow fell far behind (aggregation not run for a long time, or a brand-new monitor
// with a long backlog of raw results) catches up gradually over several runs instead of one
// run doing an unbounded amount of work.
const MAX_HOURLY_BUCKETS_PER_RUN = 48;
const MAX_DAILY_BUCKETS_PER_RUN = 31;

function floorToHour(d: Date): Date {
  return new Date(Math.floor(d.getTime() / MS_PER_HOUR) * MS_PER_HOUR);
}
function floorToDay(d: Date): Date {
  return new Date(Math.floor(d.getTime() / MS_PER_DAY) * MS_PER_DAY);
}

interface BucketAggregate {
  TotalChecks: number;
  SuccessfulChecks: number;
  AvgMs: number | null;
  MinMs: number | null;
  MaxMs: number | null;
  P95Ms: number | null;
}

async function aggregateBucket(monitorId: number, bucketStart: Date, bucketEnd: Date): Promise<BucketAggregate> {
  const db = await getDb();
  const result = await db
    .request()
    .input("monitorId", sql.Int, monitorId)
    .input("start", sql.DateTime2, bucketStart)
    .input("end", sql.DateTime2, bucketEnd)
    .query<BucketAggregate>(`
      SELECT
        COUNT(*) AS TotalChecks,
        SUM(CASE WHEN Success = 1 THEN 1 ELSE 0 END) AS SuccessfulChecks,
        AVG(CAST(TotalMs AS FLOAT)) AS AvgMs,
        MIN(TotalMs) AS MinMs,
        MAX(TotalMs) AS MaxMs,
        (SELECT DISTINCT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY TotalMs) OVER () FROM MonitorResults WHERE MonitorId = @monitorId AND CheckedAt >= @start AND CheckedAt < @end) AS P95Ms
      FROM MonitorResults
      WHERE MonitorId = @monitorId AND CheckedAt >= @start AND CheckedAt < @end
    `);
  return result.recordset[0];
}

// Rolls up MonitorResults into MonitorMetricsHourly/Daily, one monitor at a time, one bucket at
// a time - a bucket is only ever aggregated once it's fully elapsed (bucketEnd <= now), so a
// bucket's numbers never change once written (no in-progress-hour partial aggregates). Safe to
// call as often as you like: a monitor with nothing new to aggregate since the last run is a
// no-op, since the next-due-bucket lookup always starts from MAX(PeriodStart)+1 already stored.
export async function runAggregation(): Promise<{ hourlyRowsInserted: number; dailyRowsInserted: number }> {
  const db = await getDb();
  const monitors = await db.query<{ Id: number }>("SELECT Id FROM Monitors WHERE IsDeleted = 0");

  let hourlyRowsInserted = 0;
  let dailyRowsInserted = 0;
  const now = new Date();

  for (const { Id: monitorId } of monitors.recordset) {
    // --- Hourly ---
    const lastHourly = await db.request().input("id", sql.Int, monitorId).query<{ PeriodStart: Date | null }>("SELECT MAX(PeriodStart) AS PeriodStart FROM MonitorMetricsHourly WHERE MonitorId = @id");
    const firstHourly = lastHourly.recordset[0]?.PeriodStart ? new Date(lastHourly.recordset[0].PeriodStart.getTime() + MS_PER_HOUR) : null;
    let nextHourlyStart: Date;

    if (firstHourly) {
      nextHourlyStart = firstHourly;
    } else {
      const earliest = await db.request().input("id", sql.Int, monitorId).query<{ CheckedAt: Date | null }>("SELECT MIN(CheckedAt) AS CheckedAt FROM MonitorResults WHERE MonitorId = @id");
      if (!earliest.recordset[0]?.CheckedAt) continue; // nothing to aggregate for this monitor yet
      nextHourlyStart = floorToHour(new Date(earliest.recordset[0].CheckedAt));
    }

    for (let i = 0; i < MAX_HOURLY_BUCKETS_PER_RUN; i++) {
      const bucketEnd: Date = new Date(nextHourlyStart.getTime() + MS_PER_HOUR);
      if (bucketEnd.getTime() > now.getTime()) break; // this hour hasn't fully elapsed yet

      const agg = await aggregateBucket(monitorId, nextHourlyStart, bucketEnd);
      if (agg.TotalChecks > 0) {
        await db
          .request()
          .input("monitorId", sql.Int, monitorId)
          .input("periodStart", sql.DateTime2, nextHourlyStart)
          .input("totalChecks", sql.Int, agg.TotalChecks)
          .input("successfulChecks", sql.Int, agg.SuccessfulChecks)
          .input("avgMs", sql.Float, agg.AvgMs)
          .input("minMs", sql.Int, agg.MinMs)
          .input("maxMs", sql.Int, agg.MaxMs)
          .input("p95Ms", sql.Float, agg.P95Ms)
          .query(`
            INSERT INTO MonitorMetricsHourly (MonitorId, PeriodStart, TotalChecks, SuccessfulChecks, AvgMs, MinMs, MaxMs, P95Ms)
            VALUES (@monitorId, @periodStart, @totalChecks, @successfulChecks, @avgMs, @minMs, @maxMs, @p95Ms)
          `);
        hourlyRowsInserted++;
      }
      nextHourlyStart = bucketEnd;
    }

    // --- Daily ---
    const lastDaily = await db.request().input("id", sql.Int, monitorId).query<{ PeriodStart: Date | null }>("SELECT MAX(PeriodStart) AS PeriodStart FROM MonitorMetricsDaily WHERE MonitorId = @id");
    const firstDaily = lastDaily.recordset[0]?.PeriodStart ? new Date(lastDaily.recordset[0].PeriodStart.getTime() + MS_PER_DAY) : null;
    let nextDailyStart: Date;

    if (firstDaily) {
      nextDailyStart = firstDaily;
    } else {
      const earliest = await db.request().input("id", sql.Int, monitorId).query<{ CheckedAt: Date | null }>("SELECT MIN(CheckedAt) AS CheckedAt FROM MonitorResults WHERE MonitorId = @id");
      if (!earliest.recordset[0]?.CheckedAt) continue;
      nextDailyStart = floorToDay(new Date(earliest.recordset[0].CheckedAt));
    }

    for (let i = 0; i < MAX_DAILY_BUCKETS_PER_RUN; i++) {
      const bucketEnd: Date = new Date(nextDailyStart.getTime() + MS_PER_DAY);
      if (bucketEnd.getTime() > now.getTime()) break;

      const agg = await aggregateBucket(monitorId, nextDailyStart, bucketEnd);
      if (agg.TotalChecks > 0) {
        await db
          .request()
          .input("monitorId", sql.Int, monitorId)
          .input("periodStart", sql.DateTime2, nextDailyStart)
          .input("totalChecks", sql.Int, agg.TotalChecks)
          .input("successfulChecks", sql.Int, agg.SuccessfulChecks)
          .input("avgMs", sql.Float, agg.AvgMs)
          .input("minMs", sql.Int, agg.MinMs)
          .input("maxMs", sql.Int, agg.MaxMs)
          .input("p95Ms", sql.Float, agg.P95Ms)
          .query(`
            INSERT INTO MonitorMetricsDaily (MonitorId, PeriodStart, TotalChecks, SuccessfulChecks, AvgMs, MinMs, MaxMs, P95Ms)
            VALUES (@monitorId, @periodStart, @totalChecks, @successfulChecks, @avgMs, @minMs, @maxMs, @p95Ms)
          `);
        dailyRowsInserted++;
      }
      nextDailyStart = bucketEnd;
    }
  }

  return { hourlyRowsInserted, dailyRowsInserted };
}

// Aggregates are kept far longer than raw results (MonitoringSettings.AggregateRetentionDays,
// default 730 days / ~2 years) since the entire point of aggregating is long-run history for
// SLA/trend reporting well past when individual check rows are worth keeping.
export async function pruneOldAggregates(): Promise<number> {
  const db = await getDb();
  const settings = await db.query<{ AggregateRetentionDays: number }>("SELECT AggregateRetentionDays FROM MonitoringSettings WHERE Id = 1");
  const retentionDays = settings.recordset[0]?.AggregateRetentionDays ?? 730;

  const hourly = await db.request().input("days", sql.Int, retentionDays).query("DELETE FROM MonitorMetricsHourly WHERE PeriodStart < DATEADD(DAY, -@days, SYSUTCDATETIME())");
  const daily = await db.request().input("days", sql.Int, retentionDays).query("DELETE FROM MonitorMetricsDaily WHERE PeriodStart < DATEADD(DAY, -@days, SYSUTCDATETIME())");
  return (hourly.rowsAffected[0] ?? 0) + (daily.rowsAffected[0] ?? 0);
}
