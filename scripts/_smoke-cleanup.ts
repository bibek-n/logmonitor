import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

// Deletes the ephemeral smoke-test account(s) created by _smoke-mint-session.ts. Also
// removed by name prefix in case more than one was left behind by a prior interrupted run.
async function main() {
  const db = await getDb();
  const result = await db.request().query<{ Username: string }>("SELECT Username FROM Users WHERE Username LIKE 'smoke-test-bot-%'");
  for (const row of result.recordset) {
    await db.request().input("username", sql.NVarChar, row.Username).query("DELETE FROM Users WHERE Username = @username");
    console.log("deleted", row.Username);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("SMOKE_CLEANUP_ERROR", err);
  process.exit(1);
});
