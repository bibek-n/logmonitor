import "dotenv/config";
import sql from "mssql";

// Top Consumers reads WebFilterLogs across a whole time window (not filtered to one known
// SrcIp/DstIp the way most existing queries against this table are), grouping by whichever
// dimension the view needs (SrcIp, extracted website hostname, resolved user, or bandwidth per
// server). Confirmed live: an ad-hoc aggregate over just the last 24h against this table timed
// out at 15s using the existing ReceivedAt-only index (IX_WebFilterLogs_ReceivedAt) - every
// matching row needed a key lookup back to the heap for BytesSent/BytesReceived/Domain/Url/
// UserName. This adds a dedicated covering index alongside the existing one (not replacing it,
// since other code may already rely on the existing one existing) so a ReceivedAt range scan
// for this feature never needs a lookup at all.
//
// Uses its own connection pool (not src/lib/db.ts's shared getDb() singleton) with an extended
// requestTimeout - building this index on a table this large takes longer than the app's
// normal 15s default, and that default is a deliberate app-wide setting that shouldn't be
// changed just for this one-time DDL statement.
async function main() {
  const pool = await new sql.ConnectionPool({
    server: process.env.DB_SERVER!,
    database: process.env.DB_DATABASE!,
    options: { trustServerCertificate: true, encrypt: false },
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    requestTimeout: 10 * 60 * 1000,
  }).connect();

  await pool.query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_WebFilterLogs_ReceivedAt_TopConsumers')
    CREATE INDEX IX_WebFilterLogs_ReceivedAt_TopConsumers ON WebFilterLogs (ReceivedAt)
    INCLUDE (SrcIp, DstIp, Domain, Url, BytesSent, BytesReceived, UserName)
  `);

  console.log("Top Consumers covering index ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
