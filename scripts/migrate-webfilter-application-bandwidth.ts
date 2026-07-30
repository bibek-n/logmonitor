import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// Confirmed live against real RawMessage samples from the enrolled Sophos XGS126: Content
// Filtering/HTTP log lines carry app_name/app_category (Sophos's per-connection Application
// Control identification - far more granular than the generic http_category field) and
// bytes_sent/bytes_received, none of which were previously parsed or stored - see
// src/lib/sophosParser.ts's updated field mapping.
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "WebFilterLogs", "Application", "NVARCHAR(200) NULL");
  await addColumnIfMissing(db, "WebFilterLogs", "ApplicationCategory", "NVARCHAR(200) NULL");
  await addColumnIfMissing(db, "WebFilterLogs", "BytesSent", "BIGINT NULL");
  await addColumnIfMissing(db, "WebFilterLogs", "BytesReceived", "BIGINT NULL");

  console.log("WebFilterLogs Application/bandwidth columns ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
