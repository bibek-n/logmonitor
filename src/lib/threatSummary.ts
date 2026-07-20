import { getDb } from "./db";

export interface ThreatSummary {
  blocked24h: number;
  critical24h: number;
}

// Common Sophos status/action/log_subtype values meaning "the firewall stopped this" -
// covers the naming variants seen across Firewall/IPS/Anti-Virus/ATP/Content Filtering
// log categories. Confirmed against real captured data: Content Filtering/Application
// events carry this as log_subtype="Denied" (no separate status/action field).
const BLOCKED_VALUES = ["deny", "denied", "drop", "dropped", "block", "blocked", "reject", "rejected", "quarantine", "quarantined"];
// Sophos Firewall (XGS) severities follow RFC5424-style naming (Information, Notice,
// Warning, Error, Critical, Alert, Emergency), not "high"/"low" - "high" was an
// unconfirmed guess and has been replaced with the real syslog severity names.
const CRITICAL_VALUES = ["critical", "alert", "emergency"];

export async function getThreatSummary(): Promise<ThreatSummary> {
  const db = await getDb();
  const result = await db.query<{ Status: string | null; Severity: string | null }>(`
    SELECT Status, Severity FROM SophosThreatLogs
    WHERE ReceivedAt >= DATEADD(hour, -24, SYSUTCDATETIME())
  `);

  let blocked24h = 0;
  let critical24h = 0;
  for (const row of result.recordset) {
    if (row.Status && BLOCKED_VALUES.includes(row.Status.toLowerCase())) blocked24h++;
    if (row.Severity && CRITICAL_VALUES.includes(row.Severity.toLowerCase())) critical24h++;
  }

  return { blocked24h, critical24h };
}
