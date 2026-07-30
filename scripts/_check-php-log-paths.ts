import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

async function main() {
  const db = await getDb();
  const devices: [string, string][] = [
    ["Laravel-Dev", "34796e60-218b-4bfa-958b-965fb3106632"],
    ["wswordpress", "c46824ad-971a-42e7-829c-0c42e7387c18"],
    ["wordpresslive", "53ce5751-ee13-4760-84e1-e73c38d5aaa4"],
    ["laravellive", "5c623441-9b9b-4369-99c5-1f46d6f5e9a4"],
    ["gittulips", "1a3e0605-c8ec-424c-9c88-6191cc55b0be"],
    ["tulips.tt.com", "bc85cbe1-d229-439d-a232-fbce0d1c2440"],
  ];

  for (const [name, id] of devices) {
    const php = await db
      .request()
      .input("id", sql.VarChar, id)
      .query("SELECT Version, SapiCli, SapiFpm, CliErrorLogPath, FpmErrorLogPath FROM PhpVersions WHERE DeviceId = @id ORDER BY Version");
    console.log(`\n=== ${name} ===`);
    console.log(JSON.stringify(php.recordset, null, 1));
  }

  const pending = await db.query("SELECT DeviceId, Version, Sapi, CONVERT(VARCHAR(19), RequestedAt, 126) AS RequestedAt, FulfilledAt FROM PendingPhpLogRequests ORDER BY Id DESC");
  console.log("\n=== PendingPhpLogRequests (all) ===");
  console.log(JSON.stringify(pending.recordset, null, 1));

  const content = await db.query("SELECT DeviceId, Version, Sapi, LEN(Content) AS ContentLen, ErrorMessage, CONVERT(VARCHAR(19), FetchedAt, 126) AS FetchedAt FROM PhpLogContent ORDER BY FetchedAt DESC");
  console.log("\n=== PhpLogContent (all) ===");
  console.log(JSON.stringify(content.recordset, null, 1));

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
