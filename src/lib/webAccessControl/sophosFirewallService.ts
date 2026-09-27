import { getDb, sql } from "../db";
import type { WacCriticalAllowlistEntry, WacWebsiteRule } from "./types";

// ---------------------------------------------------------------------------------------
// IMPORTANT — read before touching this file.
//
// No Sophos Firewall admin/configuration API has been verified this session. This app
// already has read-only Sophos integrations elsewhere (SophosClients/SophosEvents/
// SophosFirewallRules — populated by parsing syslog the firewall sends out, see
// src/lib/sophosParser.ts), but that is a one-way feed, not a control-plane API, and it does
// not prove any admin/config endpoint exists or what its request/response shape would be.
//
// Per explicit instruction, this file does NOT invent Sophos API endpoints, payloads, auth
// schemes, or firmware-version assumptions. `StubSophosFirewallService` below is an honest
// placeholder: every method fails with a clear "not connected" error and records that in
// WacSyncStatus, so the UI never shows a fake green checkmark for a firewall this app has
// never actually talked to.
//
// To make this real: confirm which Sophos Firewall model/firmware is deployed, obtain a
// verified admin API reference for that exact version (Sophos XG/XGS API differs by
// firmware), obtain real credentials, and implement `SophosFirewallService` against that
// confirmed contract — then swap `getSophosFirewallService()` below to return it instead of
// the stub. Nothing here should be treated as a starting point for the wire format; it is
// intentionally NOT wired to any endpoint.
// ---------------------------------------------------------------------------------------

const NOT_CONFIGURED_MESSAGE =
  "Sophos Firewall integration is not yet configured - no verified admin API credentials are available for this device. " +
  "Configure SOPHOS_API_HOST / SOPHOS_API_KEY (or equivalent) once a supported API endpoint for the installed firewall version has been confirmed.";

export interface SophosSyncResult {
  success: boolean;
  error?: string;
}

export interface SophosFirewallService {
  testConnection(): Promise<SophosSyncResult>;
  syncRule(rule: WacWebsiteRule): Promise<SophosSyncResult>;
  syncAllowlistEntry(entry: WacCriticalAllowlistEntry): Promise<SophosSyncResult>;
}

type WacSyncPolicyType = "WebsiteRule" | "CriticalAllowlist";

// Records the outcome of a sync attempt in WacSyncStatus so the dashboard's "Sophos
// Synchronization Status" card reflects reality (NotConnected/Failed) rather than the
// attempt simply vanishing. One row per (PolicyType, PolicyId), upserted.
async function recordSyncStatus(policyType: WacSyncPolicyType, policyId: number, result: SophosSyncResult): Promise<void> {
  const db = await getDb();
  const status = result.success ? "Synced" : "NotConnected";
  await db
    .request()
    .input("policyType", sql.VarChar, policyType)
    .input("policyId", sql.Int, policyId)
    .input("status", sql.VarChar, status)
    .input("errorMessage", sql.NVarChar, result.error ?? null)
    .query(`
      MERGE WacSyncStatus AS target
      USING (SELECT @policyType AS PolicyType, @policyId AS PolicyId) AS src
        ON target.PolicyType = src.PolicyType AND target.PolicyId = src.PolicyId
      WHEN MATCHED THEN UPDATE SET
        Status = @status,
        LastAttemptAt = SYSUTCDATETIME(),
        LastSuccessAt = CASE WHEN @status = 'Synced' THEN SYSUTCDATETIME() ELSE target.LastSuccessAt END,
        ErrorMessage = @errorMessage
      WHEN NOT MATCHED THEN INSERT (PolicyType, PolicyId, Status, LastAttemptAt, LastSuccessAt, ErrorMessage)
        VALUES (@policyType, @policyId, @status, SYSUTCDATETIME(), CASE WHEN @status = 'Synced' THEN SYSUTCDATETIME() ELSE NULL END, @errorMessage);
    `);
}

// Honest no-op adapter. Every call fails with NOT_CONFIGURED_MESSAGE and writes an
// NotConnected row to WacSyncStatus - deliberately never returns a fake success.
class StubSophosFirewallService implements SophosFirewallService {
  async testConnection(): Promise<SophosSyncResult> {
    return { success: false, error: NOT_CONFIGURED_MESSAGE };
  }

  async syncRule(rule: WacWebsiteRule): Promise<SophosSyncResult> {
    const result: SophosSyncResult = { success: false, error: NOT_CONFIGURED_MESSAGE };
    await recordSyncStatus("WebsiteRule", rule.id, result);
    return result;
  }

  async syncAllowlistEntry(entry: WacCriticalAllowlistEntry): Promise<SophosSyncResult> {
    const result: SophosSyncResult = { success: false, error: NOT_CONFIGURED_MESSAGE };
    await recordSyncStatus("CriticalAllowlist", entry.id, result);
    return result;
  }
}

let instance: SophosFirewallService | null = null;

// Single seam a future implementation swaps: once a verified SophosFirewallService
// implementation exists, change this to return it (e.g. gated behind
// process.env.SOPHOS_API_HOST being set) instead of the stub.
export function getSophosFirewallService(): SophosFirewallService {
  if (!instance) instance = new StubSophosFirewallService();
  return instance;
}
