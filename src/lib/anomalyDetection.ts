import { getDb } from "./db";

export interface DeviceAnomaly {
  device: string;
  metric: "cpu" | "memory";
  current: number;
  baselineAvg: number;
  baselineStdev: number;
  sampledAt: string;
}

// Flags a device currently running well above ITS OWN historical norm - distinct from the
// existing Wazuh Office fixed-threshold alerts (e.g. "CPU > 90%"), which can't catch a device
// whose normal baseline is 10% suddenly spiking to 40%: still far below the fixed threshold,
// but genuinely anomalous for that specific device. Baseline is the trailing 14 days, excluding
// the last hour (so the baseline isn't itself polluted by the spike being evaluated); a device
// needs at least 20 samples in that window before it's eligible, so a newly-enrolled device
// with too little history to have a meaningful baseline is silently skipped rather than
// flagged on noise. Threshold is mean + 2 standard deviations AND an absolute floor of 50% -
// the floor keeps a device idling at ~1% with tiny natural variance from tripping on any
// routine blip (2 stdev above ~1% can be a fraction of a percent).
export async function getDeviceAnomalies(): Promise<DeviceAnomaly[]> {
  try {
    const db = await getDb();
    const result = await db.query<{
      DeviceName: string | null;
      Hostname: string;
      AvgCpu: number | null;
      StdevCpu: number | null;
      AvgMem: number | null;
      StdevMem: number | null;
      CpuPct: number | null;
      MemPct: number | null;
      ReceivedAt: string;
    }>(`
      WITH Baseline AS (
        SELECT DeviceId,
          AVG(CAST(CpuPct AS FLOAT)) AS AvgCpu,
          STDEV(CAST(CpuPct AS FLOAT)) AS StdevCpu,
          AVG(CAST(MemPct AS FLOAT)) AS AvgMem,
          STDEV(CAST(MemPct AS FLOAT)) AS StdevMem,
          COUNT(*) AS SampleCount
        FROM DeviceMetrics
        WHERE ReceivedAt >= DATEADD(DAY, -14, SYSUTCDATETIME())
          AND ReceivedAt < DATEADD(HOUR, -1, SYSUTCDATETIME())
        GROUP BY DeviceId
        HAVING COUNT(*) >= 20
      ),
      Latest AS (
        SELECT DeviceId, CpuPct, MemPct, ReceivedAt,
          ROW_NUMBER() OVER (PARTITION BY DeviceId ORDER BY ReceivedAt DESC) AS rn
        FROM DeviceMetrics
        WHERE ReceivedAt >= DATEADD(HOUR, -1, SYSUTCDATETIME())
      )
      SELECT d.DeviceName, d.Hostname, b.AvgCpu, b.StdevCpu, b.AvgMem, b.StdevMem, l.CpuPct, l.MemPct, l.ReceivedAt
      FROM Baseline b
      JOIN Latest l ON l.DeviceId = b.DeviceId AND l.rn = 1
      JOIN Devices d ON d.DeviceId = b.DeviceId
      WHERE (b.StdevCpu > 0 AND l.CpuPct > b.AvgCpu + 2 * b.StdevCpu AND l.CpuPct > 50)
         OR (b.StdevMem > 0 AND l.MemPct > b.AvgMem + 2 * b.StdevMem AND l.MemPct > 50)
    `);

    const anomalies: DeviceAnomaly[] = [];
    for (const r of result.recordset) {
      const device = r.DeviceName ?? r.Hostname;
      if (r.StdevCpu && r.CpuPct !== null && r.AvgCpu !== null && r.CpuPct > r.AvgCpu + 2 * r.StdevCpu && r.CpuPct > 50) {
        anomalies.push({ device, metric: "cpu", current: r.CpuPct, baselineAvg: r.AvgCpu, baselineStdev: r.StdevCpu, sampledAt: r.ReceivedAt });
      }
      if (r.StdevMem && r.MemPct !== null && r.AvgMem !== null && r.MemPct > r.AvgMem + 2 * r.StdevMem && r.MemPct > 50) {
        anomalies.push({ device, metric: "memory", current: r.MemPct, baselineAvg: r.AvgMem, baselineStdev: r.StdevMem, sampledAt: r.ReceivedAt });
      }
    }
    return anomalies;
  } catch {
    return [];
  }
}
