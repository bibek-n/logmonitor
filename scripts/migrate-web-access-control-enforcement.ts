import "dotenv/config";
import { getDb } from "../src/lib/db";

// Website Access Control ENFORCEMENT - additive to scripts/migrate-web-access-control.ts
// (already applied; deliberately not touched here). That earlier migration built the rules
// engine (WacWebsiteRules/WacGroups/WacCriticalAllowlist/WacSyncStatus) around eventually
// syncing to the company's Sophos Firewall, but no real Sophos admin API access exists (see
// src/lib/webAccessControl/sophosFirewallService.ts, an honest stub). Per explicit instruction,
// enforcement instead happens locally on the endpoint agent (hosts-file + DoH-policy blocking -
// see agent/wacblock_windows.go), driven by the columns this migration adds.
//
// Devices.WebsiteBlockingEnabled defaults to 0/false for EVERY device, including every
// already-enrolled one - same "opt-in per device, never silently enabled" guarantee already
// used for ScreenshotIntervalMinutes/BrowserActivityIntervalMinutes. An admin must explicitly
// flip it on per device (see the settings PATCH route and DeviceDetail's Settings panel) before
// that device's agent is ever sent a non-empty wacBlockedDomains list.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Devices') AND name = 'WebsiteBlockingEnabled')
    ALTER TABLE Devices ADD WebsiteBlockingEnabled BIT NOT NULL DEFAULT 0
  `;

  // WacLastAppliedAt/WacLastError let the agent report back what it actually applied (and any
  // error hit while applying it) through the existing heartbeat round-trip - see
  // client.go's Heartbeat() (wacAppliedDomains/wacError in the POST body) and
  // /api/agent/heartbeat/route.ts, which persists them here. Both NULL until an agent with
  // website blocking enabled actually reports in at least once.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Devices') AND name = 'WacLastAppliedAt')
    ALTER TABLE Devices ADD WacLastAppliedAt DATETIME2 NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Devices') AND name = 'WacLastError')
    ALTER TABLE Devices ADD WacLastError NVARCHAR(1000) NULL
  `;

  console.log("Web Access Control enforcement columns ready (Devices.WebsiteBlockingEnabled/WacLastAppliedAt/WacLastError).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
