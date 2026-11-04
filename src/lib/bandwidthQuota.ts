import { getDb, sql } from "./db";
import { getTopBandwidthStaff } from "./topConsumers";

export interface BandwidthQuotaSettings {
  dailyCapGb: number | null;
  enabled: boolean;
}

// Tolerates the BandwidthQuotaSettings table not existing yet (a one-time migration this
// feature depends on) rather than throwing - this is called from getRecentAlerts/getAlertHistory,
// which the Header component awaits on every dashboard page, so an unhandled error here would
// take down navigation site-wide rather than just disabling this one feature.
export async function getBandwidthQuotaSettings(): Promise<BandwidthQuotaSettings> {
  try {
    const db = await getDb();
    const result = await db.query<{ DailyCapGb: number | null; Enabled: boolean }>(
      "SELECT DailyCapGb, Enabled FROM BandwidthQuotaSettings WHERE Id = 1"
    );
    const row = result.recordset[0];
    return { dailyCapGb: row?.DailyCapGb ?? null, enabled: row?.Enabled ?? false };
  } catch {
    return { dailyCapGb: null, enabled: false };
  }
}

export async function updateBandwidthQuotaSettings(input: { dailyCapGb?: number | null; enabled?: boolean }, userId: number): Promise<void> {
  const db = await getDb();
  const current = await getBandwidthQuotaSettings();
  await db
    .request()
    .input("dailyCapGb", sql.Float, input.dailyCapGb !== undefined ? input.dailyCapGb : current.dailyCapGb)
    .input("enabled", sql.Bit, input.enabled !== undefined ? input.enabled : current.enabled)
    .input("userId", sql.Int, userId)
    .query(
      "UPDATE BandwidthQuotaSettings SET DailyCapGb = @dailyCapGb, Enabled = @enabled, UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @userId WHERE Id = 1"
    );
}

export interface BandwidthQuotaBreach {
  name: string;
  ipAddresses: string[];
  totalBytes: number;
  capBytes: number;
}

// Monitoring-only by design (the user explicitly deferred live enforcement/throttling): this
// only ever reports who WOULD have been capped, reusing the same combined Sophos+MikroTik
// per-staff totals the Top Consumers page already shows (getTopBandwidthStaff), compared
// against the configured daily cap. Nothing here blocks or throttles traffic.
export async function getBandwidthQuotaBreaches(hours: number): Promise<BandwidthQuotaBreach[]> {
  const settings = await getBandwidthQuotaSettings();
  if (!settings.enabled || !settings.dailyCapGb) return [];
  const capBytes = settings.dailyCapGb * 1024 * 1024 * 1024;
  try {
    const staffUsage = await getTopBandwidthStaff(hours, 500);
    return staffUsage
      .filter((s) => s.totalBytes > capBytes)
      .map((s) => ({ name: s.name, ipAddresses: s.ipAddresses, totalBytes: s.totalBytes, capBytes }));
  } catch {
    return [];
  }
}
