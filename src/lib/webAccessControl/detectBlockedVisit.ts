import { getDb, sql } from "../db";
import { loadRulesEngineData, getStaffGroupId } from "./loadData";
import { resolveAccess } from "./rulesEngine";

// Best-effort detection of an employee visiting a site Website Access Control's own rules
// say should be blocked for them - built on top of Browser Activity ingestion (already
// flowing from every device with that collector enabled) rather than new agent-side work,
// since the agent's own local enforcement (agent/wacblock_windows.go) is a one-way hosts-file
// sinkhole with no way to report back "the user just tried this" - it only ever makes DNS
// resolution fail silently. A Browser Activity event existing at all for a domain that
// resolveAccess() says should be Block means either local enforcement hasn't caught up yet
// (a device just opted in, or a heartbeat is still pending) or something bypassed it (a VPN,
// a proxy, a stale hosts file) - either way, an admin configured a policy that isn't holding
// for this person right now, which is exactly what deserves a notification.
//
// Deliberately does NOT gate on Devices.WebsiteBlockingEnabled - the point is to surface a
// policy violation even (especially) on a device where local enforcement isn't actually live
// yet, not just to double-confirm devices that are already working correctly.
export async function flagBlockedVisits(deviceId: string, staffId: number | null, domains: string[]): Promise<void> {
  if (staffId === null || domains.length === 0) return;

  const { rules, allowlist, schedules } = await loadRulesEngineData();
  if (rules.length === 0) return; // nothing configured - skip the DB round trips below entirely
  const staffGroupId = await getStaffGroupId(staffId);

  const db = await getDb();
  for (const domain of new Set(domains)) {
    const resolution = resolveAccess({ domain, staffId, staffGroupId, rules, allowlist, schedules });
    if (resolution.decision !== "Block") continue;

    // Dedup against the last hour so one browsing session against a blocked domain (repeated
    // navigation attempts, multiple tabs, a page auto-refreshing) raises one alert, not a
    // flood of identical ones.
    const dup = await db
      .request()
      .input("deviceId", sql.VarChar, deviceId)
      .input("domain", sql.NVarChar, `%${domain}%`)
      .query<{ Cnt: number }>(`
        SELECT COUNT(*) AS Cnt FROM DeviceAlerts
        WHERE DeviceId = @deviceId AND AlertType = 'wac_blocked_site_visit'
          AND Message LIKE @domain AND TriggeredAt >= DATEADD(HOUR, -1, SYSUTCDATETIME())
      `);
    if (dup.recordset[0].Cnt > 0) continue;

    await db
      .request()
      .input("deviceId", sql.VarChar, deviceId)
      .input("message", sql.NVarChar, `Visited ${domain}, which is blocked by Website Access Control policy.`)
      .query(`
        INSERT INTO DeviceAlerts (DeviceId, AlertType, Severity, Message, TriggeredAt)
        VALUES (@deviceId, 'wac_blocked_site_visit', 'warning', @message, SYSUTCDATETIME())
      `);
  }
}
