import "dotenv/config";
import { getDb } from "../src/lib/db";

// Per-flow IP accounting rows from the MikroTik's /ip accounting feature (enabled 2026-07-21
// specifically for this table - `/ip accounting set enabled=yes account-local-traffic=yes`).
// Each row is one src/dst address pair's byte count since the last snapshot-and-clear cycle
// (poll-router-clients.ts runs "/ip accounting snapshot take" then reads+clears it every poll,
// so rows here are per-interval deltas, not a cumulative running total) - unlike RouterBandwidth
// (router-wide interface throughput, only 2 fixed interfaces) this is genuinely per-client,
// keyed by whichever IP is the client (the "Top Router Clients" ranking in topConsumers.ts
// attributes a row's bytes to whichever side matches a known RouterClients.IpAddress).
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RouterClientTraffic' AND xtype='U')
    CREATE TABLE RouterClientTraffic (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      ReceivedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      SrcAddress VARCHAR(45) NOT NULL,
      DstAddress VARCHAR(45) NOT NULL,
      Packets BIGINT NOT NULL,
      Bytes BIGINT NOT NULL
    )
  `;

  // Covering index: the Top Router Clients query filters/aggregates entirely off ReceivedAt +
  // SrcAddress/DstAddress/Bytes, so this lets it answer straight from the index with no table
  // lookups even once this table grows to the size a 2-minute poll interval over 7 days implies.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_RouterClientTraffic_ReceivedAt')
    CREATE INDEX IX_RouterClientTraffic_ReceivedAt ON RouterClientTraffic (ReceivedAt DESC) INCLUDE (SrcAddress, DstAddress, Bytes)
  `;

  console.log("RouterClientTraffic table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
