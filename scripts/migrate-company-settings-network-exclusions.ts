import "dotenv/config";
import { getDb } from "../src/lib/db";

// Lets an admin exclude this deployment's own infrastructure (the firewall itself, the
// router's own management addresses, a VPN concentrator, extra AP/switch appliances - see
// src/lib/topConsumers.ts) from traffic rankings, instead of those IPs being hardcoded
// literals baked into the app. NULL by default (nothing excluded) is the correct, safe default
// for a brand-new company's own deployment - this migration deliberately does NOT seed any
// values, since a value correct for one company's network would be meaningless, or actively
// wrong, on someone else's.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (
      SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CompanySettings') AND name = 'FirewallSelfIps'
    )
    ALTER TABLE CompanySettings ADD FirewallSelfIps NVARCHAR(1000) NULL
  `;

  await db.query`
    IF NOT EXISTS (
      SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CompanySettings') AND name = 'RankingExcludedInfraIps'
    )
    ALTER TABLE CompanySettings ADD RankingExcludedInfraIps NVARCHAR(1000) NULL
  `;

  console.log("FirewallSelfIps and RankingExcludedInfraIps columns ready on CompanySettings.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
