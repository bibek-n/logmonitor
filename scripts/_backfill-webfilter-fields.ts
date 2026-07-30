import "dotenv/config";
import sql from "mssql";
import { parseSophosLog } from "../src/lib/sophosParser";

// One-time backfill: re-parses every WebFilterLogs row's already-stored RawMessage through the
// now-fixed parser (domain=/http_category=/http_category_type= instead of the old wrong key
// names) and populates Application/ApplicationCategory/BytesSent/BytesReceived, which never
// existed before. Idempotent and safe to re-run/resume - it always derives values fresh from
// RawMessage, never reads its own prior output.
//
// Uses a permanent staging table (not a local #temp table) because the `mssql` connection pool
// doesn't guarantee the bulk-insert and the following UPDATE run on the same physical
// connection, and local temp tables are connection-scoped.
//
// Dedicated connection with a long requestTimeout - src/lib/db.ts's shared pool uses mssql's
// 15s default, which a bulk insert + UPDATE...JOIN against a live, actively-written 9.58M-row
// table can legitimately exceed under real lock contention with the concurrently-running
// syslog listener. Not changed in the shared db.ts on purpose - that default is fine for every
// normal request-path query in the app; this is a one-off migration's problem, not the app's.
const BATCH_SIZE = 10000;

// Some raw Sophos log lines produce parsed field values longer than the target column
// (malformed quoting upstream, or a genuinely long value) - bcp rejects the whole batch
// with "invalid column length" rather than truncating, so clamp defensively to match
// WebFilterLogs' actual declared column widths (migrate-webfilter.ts / migrate-webfilter-application-bandwidth.ts).
function clamp(value: string | null, maxLen: number): string | null {
  if (value === null) return null;
  return value.length > maxLen ? value.slice(0, maxLen) : value;
}

async function getBackfillDb() {
  return new sql.ConnectionPool({
    server: process.env.DB_SERVER!,
    database: process.env.DB_DATABASE!,
    options: { trustServerCertificate: true, encrypt: false },
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    requestTimeout: 120000,
    connectionTimeout: 30000,
  }).connect();
}

async function main() {
  const db = await getBackfillDb();

  await db.query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebFilterBackfillStaging' AND xtype='U')
    CREATE TABLE WebFilterBackfillStaging (
      Id BIGINT PRIMARY KEY,
      Domain NVARCHAR(500) NULL,
      Category NVARCHAR(200) NULL,
      CategoryType NVARCHAR(100) NULL,
      Application NVARCHAR(200) NULL,
      ApplicationCategory NVARCHAR(200) NULL,
      BytesSent BIGINT NULL,
      BytesReceived BIGINT NULL
    )
  `);

  const rangeResult = await db.query<{ MinId: number; MaxId: number; Total: number }>(
    "SELECT MIN(Id) AS MinId, MAX(Id) AS MaxId, COUNT(*) AS Total FROM WebFilterLogs WHERE RawMessage IS NOT NULL"
  );
  const { MinId: minId, MaxId: maxId, Total: total } = rangeResult.recordset[0];
  console.log(`Backfilling WebFilterLogs Id ${minId}..${maxId} (${total} rows with RawMessage), batch size ${BATCH_SIZE}`);

  let updatedTotal = 0;
  let batchStart = minId;
  const startedAt = Date.now();

  while (batchStart <= maxId) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, maxId);

    const rows = await db
      .request()
      .input("start", sql.BigInt, batchStart)
      .input("end", sql.BigInt, batchEnd)
      .query<{ Id: number; RawMessage: string }>(
        "SELECT Id, RawMessage FROM WebFilterLogs WHERE Id BETWEEN @start AND @end AND RawMessage IS NOT NULL"
      );

    if (rows.recordset.length > 0) {
      try {
        const table = new sql.Table("WebFilterBackfillStaging");
        table.create = false;
        table.columns.add("Id", sql.BigInt, { nullable: false });
        table.columns.add("Domain", sql.NVarChar(500), { nullable: true });
        table.columns.add("Category", sql.NVarChar(200), { nullable: true });
        table.columns.add("CategoryType", sql.NVarChar(100), { nullable: true });
        table.columns.add("Application", sql.NVarChar(200), { nullable: true });
        table.columns.add("ApplicationCategory", sql.NVarChar(200), { nullable: true });
        table.columns.add("BytesSent", sql.BigInt, { nullable: true });
        table.columns.add("BytesReceived", sql.BigInt, { nullable: true });

        for (const row of rows.recordset) {
          const p = parseSophosLog(row.RawMessage);
          table.rows.add(
            row.Id,
            clamp(p.domain, 500),
            clamp(p.category, 200),
            clamp(p.categoryType, 100),
            clamp(p.application, 200),
            clamp(p.applicationCategory, 200),
            p.bytesSent,
            p.bytesReceived
          );
        }

        const bulkRequest = db.request();
        await bulkRequest.query("TRUNCATE TABLE WebFilterBackfillStaging");
        await bulkRequest.bulk(table);

        const updateResult = await db.request().query(`
          UPDATE w
          SET Domain = s.Domain, Category = s.Category, CategoryType = s.CategoryType,
              Application = s.Application, ApplicationCategory = s.ApplicationCategory,
              BytesSent = s.BytesSent, BytesReceived = s.BytesReceived
          FROM WebFilterLogs w
          JOIN WebFilterBackfillStaging s ON w.Id = s.Id
        `);
        updatedTotal += updateResult.rowsAffected[0] ?? 0;
      } catch (batchErr) {
        // Don't let one bad batch (e.g. an unanticipated oversized field) kill a 9.6M-row run -
        // log it and move on; the batch can be re-examined/re-run individually afterward.
        console.error(`  BATCH FAILED Id ${batchStart}..${batchEnd}:`, batchErr instanceof Error ? batchErr.message : batchErr);
      }
    }

    const elapsedSec = (Date.now() - startedAt) / 1000;
    console.log(`  ...through Id ${batchEnd} (${updatedTotal} rows updated so far, ${elapsedSec.toFixed(0)}s elapsed)`);

    batchStart = batchEnd + 1;
  }

  await db.query("DROP TABLE WebFilterBackfillStaging");
  console.log(`Backfill complete: ${updatedTotal} rows updated in ${((Date.now() - startedAt) / 1000).toFixed(0)}s`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
